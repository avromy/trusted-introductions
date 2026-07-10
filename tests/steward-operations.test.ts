import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import StewardOperationsPage from '@/app/steward/operations/page';
import { classifyStewardOperationsQueue } from '@/lib/steward/operations/queue';
import type { Database } from '@/types/supabase';

type RequestRow = Database['public']['Tables']['job_seeker_requests']['Row'];
type MatchRow = Database['public']['Tables']['match_suggestions']['Row'];
type ReviewRow = Database['public']['Tables']['steward_reviews']['Row'];
type IntroRow = Database['public']['Tables']['introductions']['Row'];
type AuditRow = Database['public']['Tables']['audit_events']['Row'];

vi.mock('@/lib/steward/operations/queue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/steward/operations/queue')>();
  return { ...actual, getStewardOperationsQueue: vi.fn() };
});

import { getStewardOperationsQueue } from '@/lib/steward/operations/queue';

const now = '2026-07-10T00:00:00.000Z';
const request: RequestRow = { id: 'request-1', identity_id: 'seeker-private', status: 'open', headline: 'Product role search', target_role: 'PM', target_companies: ['A'], target_locations: ['NYC'], remote_preference: null, salary_expectation: 'private salary', work_authorization: 'private auth', notes: 'private seeker note', resume_url: 'https://private/resume.pdf', created_at: now, updated_at: now, opened_at: now, closed_at: null };
const match: MatchRow = { id: 'match-1', request_id: 'request-1', helper_identity_id: 'helper-1', helper_capability_id: 'cap-1', rank: 1, score: 90, reasons: ['reason'], metadata: { privateNotes: 'do not expose' }, created_at: now, updated_at: now };
const needsInfo: ReviewRow = { id: 'review-info', request_id: 'request-1', steward_identity_id: 'steward-1', subject_identity_id: 'helper-1', match_suggestion_id: 'match-info', status: 'needs_info', decision_reason: 'private decision reason', created_at: now, updated_at: now, decided_at: now };
const approved: ReviewRow = { ...needsInfo, id: 'review-approved', match_suggestion_id: 'match-approved', status: 'approved' };
const introReady: IntroRow = { id: 'intro-ready', request_id: 'request-1', match_id: 'match-approved', steward_review_id: 'review-intro', requester_identity_id: 'seeker-private', helper_identity_id: 'helper-1', created_by_identity_id: 'steward-1', status: 'ready', context: { message: 'private intro copy' }, created_at: now, updated_at: now };
const introCompleted: IntroRow = { ...introReady, id: 'intro-completed', status: 'completed', steward_review_id: 'review-completed' };
const audit: AuditRow = { id: 'audit-1', actor_identity_id: 'helper-1', community_id: null, event_type: 'introduction_outcome.connected', subject_table: 'introductions', subject_id: 'other-intro', metadata: { outcome: 'connected', note: 'private outcome note' }, created_at: now };

describe('steward operations queue classification', () => {
  it('classifies actionable workflow records without creating new statuses', () => {
    const queue = classifyStewardOperationsQueue({ requests: [request], matches: [match], reviews: [needsInfo, approved], introductions: [introReady, introCompleted], auditEvents: [audit] });
    expect(queue.counts).toMatchObject({ requests_awaiting_match_review: 1, reviews_needing_information: 1, approved_matches_awaiting_introduction: 1, introductions_needing_follow_up: 1, introductions_awaiting_outcome: 1 });
    expect(queue.items.map((item) => item.href)).toEqual(expect.arrayContaining(['/steward/requests/request-1/matches', '/introductions/intro-ready/follow-up', '/introductions/intro-completed/outcome']));
  });

  it('returns privacy-safe item shapes', () => {
    const queue = classifyStewardOperationsQueue({ requests: [request], matches: [match], reviews: [needsInfo], introductions: [introReady, introCompleted], auditEvents: [audit] });
    const serialized = JSON.stringify(queue.items);
    expect(serialized).not.toContain('private salary');
    expect(serialized).not.toContain('private seeker note');
    expect(serialized).not.toContain('resume.pdf');
    expect(serialized).not.toContain('private intro copy');
    expect(serialized).not.toContain('private outcome note');
    expect(serialized).not.toContain('private decision reason');
  });

  it('applies bounded pagination', () => {
    const queue = classifyStewardOperationsQueue({ requests: [request], matches: [match], reviews: [needsInfo, approved], introductions: [introReady, introCompleted], auditEvents: [], limit: 2, offset: 1 });
    expect(queue.items).toHaveLength(2);
    expect(queue.pagination).toMatchObject({ limit: 2, offset: 1, returned: 2, hasMore: true });
  });
});

describe('steward operations route rendering', () => {
  it('renders unauthorized state', async () => {
    vi.mocked(getStewardOperationsQueue).mockResolvedValueOnce({ ok: false, state: 'unauthorized', message: 'Nope' });
    const markup = renderToStaticMarkup(await StewardOperationsPage({ searchParams: {} }));
    expect(markup).toContain('Steward access required');
  });

  it('renders error state', async () => {
    vi.mocked(getStewardOperationsQueue).mockResolvedValueOnce({ ok: false, state: 'error', message: 'Queue failed' });
    const markup = renderToStaticMarkup(await StewardOperationsPage({ searchParams: {} }));
    expect(markup).toContain('Queue unavailable');
    expect(markup).toContain('Queue failed');
  });

  it('renders empty and populated queue states', async () => {
    vi.mocked(getStewardOperationsQueue).mockResolvedValueOnce({ ok: true, queue: { counts: { requests_awaiting_match_review: 0, reviews_needing_information: 0, approved_matches_awaiting_introduction: 0, introductions_needing_follow_up: 0, introductions_awaiting_outcome: 0 }, pagination: { limit: 25, offset: 0, returned: 0, hasMore: false }, items: [] } });
    expect(renderToStaticMarkup(await StewardOperationsPage({ searchParams: {} }))).toContain('No operational queue items');
    vi.mocked(getStewardOperationsQueue).mockResolvedValueOnce({ ok: true, queue: classifyStewardOperationsQueue({ requests: [request], matches: [match], reviews: [], introductions: [], auditEvents: [] }) });
    const markup = renderToStaticMarkup(await StewardOperationsPage({ searchParams: {} }));
    expect(markup).toContain('Requests awaiting match review');
    expect(markup).toContain('/steward/requests/request-1/matches');
  });
});
