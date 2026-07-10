import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InviteOnboardingPage from '@/app/onboarding/invite/page';
import { hashInviteToken, type InvitationRow } from '@/lib/invites';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

const TOKEN = 'plaintext-invite-token';

type InviteOverride = Partial<InvitationRow> | null;

function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: 'invite-123',
    invitee_email: 'invitee@example.com',
    inviter_identity_id: 'identity-inviter',
    community_id: 'community-123',
    token_hash: hashInviteToken(TOKEN),
    status: 'pending',
    redemption_status: 'not_redeemed',
    expires_at: '2026-07-14T12:00:00.000Z',
    redeemed_at: null,
    redeemed_by_identity_id: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function createPageClient(
  inviteOverride: InviteOverride,
  user: { id: string } | null = { id: 'user-123' },
) {
  const invite = inviteOverride === null ? null : invitation(inviteOverride);
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: invite, error: null })),
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
    from: vi.fn(() => builder),
  };
}

async function renderInvitePage(
  token: string | undefined,
  inviteOverride: InviteOverride,
  user: { id: string } | null = { id: 'user-123' },
) {
  mockCreateClient.mockReturnValue(createPageClient(inviteOverride, user));
  const element = await InviteOnboardingPage({ searchParams: token ? { token } : undefined });

  return renderToStaticMarkup(element);
}

describe('InviteOnboardingPage', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mockCreateClient.mockReset();
  });

  it('renders production copy for a valid invite', async () => {
    const html = await renderInvitePage(TOKEN, {});

    expect(html).toContain('Your trusted invitation is ready');
    expect(html).toContain('Continue onboarding');
    expect(html).toContain('invitee@example.com');
  });

  it('renders an explicit unauthenticated state for a valid invite without a signed-in user', async () => {
    const html = await renderInvitePage(TOKEN, {}, null);

    expect(html).toContain('Sign in to accept this invitation');
    expect(html).toContain('Sign in with the email address that received the invite');
    expect(html).not.toContain('Continue onboarding');
  });

  it.each([
    ['expired', { expires_at: '2020-01-01T00:00:00.000Z' }, 'This invite link has expired'],
    [
      'revoked',
      { status: 'revoked' as const, redemption_status: 'blocked' as const },
      'This invite is no longer available',
    ],
    [
      'redeemed',
      {
        status: 'accepted' as const,
        redemption_status: 'redeemed' as const,
        redeemed_at: '2026-07-07T12:00:00.000Z',
      },
      'This invite has already been redeemed',
    ],
  ])('renders the %s invite state', async (_, overrides, expectedCopy) => {
    const html = await renderInvitePage(TOKEN, overrides);

    expect(html).toContain(expectedCopy);
    expect(html).not.toContain('Continue onboarding');
  });
});
