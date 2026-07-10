import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { hashInviteToken } from '@/lib/invites';
import { checkboxChecked, htmlIncludesNavigationAction, inviteRow, renderPage, selectValue } from './helpers';

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  invite: null as null | Record<string, unknown>,
  identity: null as null | Record<string, unknown>,
  roles: [] as Array<Record<string, unknown>>,
  privacy: null as null | Record<string, unknown>,
  progress: null as unknown,
}));

function tableResult(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => {
      if (table === 'invitations') return { data: state.invite, error: null };
      if (table === 'trusted_identities') return { data: state.identity, error: null };
      if (table === 'privacy_settings') return { data: state.privacy, error: null };
      return { data: null, error: null };
    }),
    then: (resolve: any) => resolve({ data: table === 'user_roles' ? state.roles : [], error: null }),
  };
  return chain;
}

vi.mock('@/lib/env', () => ({
  getEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY: '' }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    from: vi.fn((table: string) => tableResult(table)),
  }),
}));

vi.mock('@/lib/onboarding/server', () => ({
  getCurrentOnboardingProgress: vi.fn(async () => state.progress),
}));

vi.mock('@/lib/onboarding/completion-actions', () => ({ completeOnboardingAction: vi.fn() }));

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    useFormState: () => [{ ok: false, message: null }, vi.fn()],
    useFormStatus: () => ({ pending: false }),
  };
});

import InviteOnboardingPage from '@/app/onboarding/invite/page';
import RoleOnboardingPage from '@/app/onboarding/role/page';
import ProfileOnboardingPage from '@/app/onboarding/profile/page';
import PrivacyOnboardingPage from '@/app/onboarding/privacy/page';
import CompleteOnboardingPage from '@/app/onboarding/complete/page';

const validToken = 'valid-e2e-token';

function authenticatedOnboardingState() {
  state.user = { id: 'user-e2e', email: 'invitee@example.com' };
  state.invite = inviteRow({ token_hash: hashInviteToken(validToken) });
  state.identity = {
    id: 'identity-e2e',
    user_id: 'user-e2e',
    status: 'active',
    display_name: 'Invitee Example',
    metadata: { contributionMode: 'both' },
  };
  state.roles = [{ role: 'member' }, { role: 'helper' }];
  state.privacy = {
    identity_id: 'identity-e2e',
    profile_visibility: 'private',
    resume_visibility: 'private',
    contact_visibility: 'private',
    public_meet_page_enabled: false,
    helper_activity_visible: false,
    allow_ai_summary: false,
  };
  state.progress = {
    isComplete: true,
    step: 'complete',
    nextRoute: '/onboarding/complete',
    missingRequirements: [],
    checks: {
      inviteValid: true,
      trustedIdentityActive: true,
      roleOrContributionModeComplete: true,
      profileComplete: true,
      privacySettingsComplete: true,
    },
    state: {
      invite: { status: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' },
      trustedIdentity: { id: 'identity-e2e', status: 'active', roles: ['helper'], contributionMode: 'both' },
      profile: { id: 'identity-e2e', displayName: 'Invitee Example' },
      privacySettings: {
        profileVisibility: 'private',
        resumeVisibility: 'private',
        contactVisibility: 'private',
        publicMeetPageEnabled: false,
        helperActivityVisible: false,
        allowAiSummary: false,
      },
    },
  };
}

describe('onboarding browser E2E coverage', () => {
  beforeEach(() => {
    state.user = null;
    state.invite = null;
    state.identity = null;
    state.roles = [];
    state.privacy = null;
    state.progress = null;
  });

  it('blocks missing invite tokens from continuing', async () => {
    const html = await renderPage(InviteOnboardingPage({ searchParams: {} }));

    expect(html).toContain('Open this page from your invite link');
    expect(htmlIncludesNavigationAction(html, 'Continue onboarding')).toBe(false);
  });

  it('blocks invalid, expired, and redeemed invites from continuing', async () => {
    let html = await renderPage(InviteOnboardingPage({ searchParams: { token: 'invalid' } }));
    expect(html).toContain('This invite link is not valid');
    expect(htmlIncludesNavigationAction(html, 'Continue onboarding')).toBe(false);

    state.invite = inviteRow({ token_hash: hashInviteToken(validToken), expires_at: '2020-01-01T00:00:00.000Z' });
    html = await renderPage(InviteOnboardingPage({ searchParams: { token: validToken } }));
    expect(html).toContain('This invite link has expired');
    expect(htmlIncludesNavigationAction(html, 'Continue onboarding')).toBe(false);

    state.invite = inviteRow({ token_hash: hashInviteToken(validToken), redeemed_at: '2026-01-01T00:00:00.000Z', redemption_status: 'redeemed', status: 'redeemed' });
    html = await renderPage(InviteOnboardingPage({ searchParams: { token: validToken } }));
    expect(html).toContain('This invite has already been redeemed');
    expect(htmlIncludesNavigationAction(html, 'Continue onboarding')).toBe(false);
  });

  it('requires authentication for a valid invite and continues when authenticated', async () => {
    state.invite = inviteRow({ token_hash: hashInviteToken(validToken) });
    let html = await renderPage(InviteOnboardingPage({ searchParams: { token: validToken } }));
    expect(html).toContain('Sign in to accept this invitation');
    expect(htmlIncludesNavigationAction(html, 'Continue onboarding')).toBe(false);

    state.user = { id: 'user-e2e', email: 'invitee@example.com' };
    html = await renderPage(InviteOnboardingPage({ searchParams: { token: validToken } }));
    expect(html).toContain('Your trusted invitation is ready');
    expect(htmlIncludesNavigationAction(html, 'Continue onboarding')).toBe(true);
  });

  it('covers role selection, profile completion, privacy defaults persistence, and onboarding completion', async () => {
    authenticatedOnboardingState();

    const roleHtml = await renderPage(RoleOnboardingPage({ searchParams: Promise.resolve({}) }));
    expect(roleHtml).toContain('Choose how you want to participate');
    expect(roleHtml).toContain('Both');
    expect(roleHtml).toContain('Save role preferences');

    const profileHtml = await renderPage(<ProfileOnboardingPage searchParams={{ saved: '1' }} />);
    expect(profileHtml).toContain('Profile details saved.');
    expect(profileHtml).toContain('Display name');
    expect(profileHtml).toContain('Continue to privacy');

    const privacyHtml = await renderPage(PrivacyOnboardingPage());
    expect(selectValue(privacyHtml, 'profileVisibility')).toBe('private');
    expect(selectValue(privacyHtml, 'resumeVisibility')).toBe('private');
    expect(selectValue(privacyHtml, 'contactVisibility')).toBe('private');
    expect(checkboxChecked(privacyHtml, 'publicMeetPageEnabled')).toBe(false);
    expect(checkboxChecked(privacyHtml, 'allowAiSummary')).toBe(false);

    const completeHtml = await renderPage(CompleteOnboardingPage());
    expect(completeHtml).toContain('You are ready for trusted introductions');
    expect(completeHtml).toContain('Complete onboarding');
    expect(completeHtml).toContain('Profile completed');
    expect(completeHtml).toContain('Privacy settings confirmed');
  });
});
