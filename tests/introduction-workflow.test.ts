import { describe, expect, it, vi } from 'vitest';
import { createIntroductionFromStewardReviewAction, type CreateIntroductionActionClient } from '@/lib/introductions/actions';
import { createIntroduction, mapIntroductionRow, type IntroductionRow } from '@/lib/introductions/repository';
import type { JobSeekerRequestRow } from '@/lib/matching/job-seeker-repository';
import type { StewardReviewRow } from '@/lib/matching/steward-review-repository';

const NOW = new Date('2026-07-08T00:00:00.000Z');

function review(overrides: Partial<StewardReviewRow> = {}): StewardReviewRow {
  return {
    id: 'review-1',
    request_id: 'request-1',
    steward_identity_id: 'steward-1',
    subject_identity_id: 'helper-1',
    match_suggestion_id: 'match-1',
    status: 'approved',
    decision_reason: null,
    decided_at: NOW.toISOString(),
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function request(overrides: Partial<JobSeekerRequestRow> = {}): JobSeekerRequestRow {
  return {
    id: 'request-1',
    identity_id: 'requester-1',
    status: 'open',
    headline: 'Seeking product role',
    target_role: 'Product Manager',
    target_companies: [],
    target_locations: [],
    remote_preference: null,
    salary_expectation: null,
    work_authorization: null,
    notes: null,
    resume_url: null,
    opened_at: NOW.toISOString(),
    closed_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function intro(overrides: Partial<IntroductionRow> = {}): IntroductionRow {
  return {
    id: 'intro-1',
    request_id: 'request-1',
    match_id: 'match-1',
    steward_review_id: 'review-1',
    requester_identity_id: 'requester-1',
    helper_identity_id: 'helper-1',
    created_by_identity_id: 'steward-1',
    status: 'draft',
    context: { source: 'steward_review', stewardReviewId: 'review-1', messageContentStored: false },
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function createClient(options: { steward: boolean; review?: StewardReviewRow }) {
  const inserts: unknown[] = [];
  const auditEvents: unknown[] = [];
  const introRow = intro();

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: { id: 'steward-1', status: 'active', user_id: 'user-1' }, error: null })) };
      }
      if (table === 'user_roles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: options.steward ? [{ role: 'steward', community_id: null }] : [{ role: 'member', community_id: null }], error: null })) };
      }
      if (table === 'steward_reviews') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: options.review ?? review(), error: null })) };
      }
      if (table === 'job_seeker_requests') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: request(), error: null })) };
      }
      if (table === 'introductions') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn((payload) => { inserts.push(payload); return builder; }),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: { ...introRow, ...(inserts.at(-1) as object | undefined) }, error: null })),
          maybeSingle: vi.fn(async () => ({ data: introRow, error: null })),
        };
        return builder;
      }
      if (table === 'audit_events') {
        return { insert: vi.fn(async (payload) => { auditEvents.push(payload); return { error: null }; }) };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  } as unknown as CreateIntroductionActionClient;

  return { client, inserts, auditEvents };
}

describe('introduction repository', () => {
  it('maps and persists introduction rows', async () => {
    const { client, inserts } = createClient({ steward: true });

    expect(mapIntroductionRow(intro())).toMatchObject({ id: 'intro-1', requestId: 'request-1', helperIdentityId: 'helper-1' });
    await expect(createIntroduction({ requestId: ' request-1 ', matchId: ' match-1 ', stewardReviewId: ' review-1 ', requesterIdentityId: ' requester-1 ', helperIdentityId: ' helper-1 ', createdByIdentityId: ' steward-1 ' }, client)).resolves.toMatchObject({ id: 'intro-1' });
    expect(inserts[0]).toMatchObject({ request_id: 'request-1', match_id: 'match-1', requester_identity_id: 'requester-1', helper_identity_id: 'helper-1', status: 'draft' });
  });
});

describe('createIntroductionFromStewardReviewAction', () => {
  it('creates an introduction from an approved match', async () => {
    const { client, inserts } = createClient({ steward: true });

    const result = await createIntroductionFromStewardReviewAction('review-1', { supabase: client, now: NOW });

    expect(result).toMatchObject({ ok: true, introduction: { requestId: 'request-1', matchId: 'match-1', requesterIdentityId: 'requester-1', helperIdentityId: 'helper-1' } });
    expect(inserts[0]).toMatchObject({ request_id: 'request-1', match_id: 'match-1', steward_review_id: 'review-1', requester_identity_id: 'requester-1', helper_identity_id: 'helper-1' });
  });

  it('fails when the steward match is rejected', async () => {
    const { client, inserts } = createClient({ steward: true, review: review({ status: 'rejected' }) });

    await expect(createIntroductionFromStewardReviewAction('review-1', { supabase: client, now: NOW })).resolves.toMatchObject({ ok: false, error: 'not_approved' });
    expect(inserts).toHaveLength(0);
  });

  it('fails for unauthorized users', async () => {
    const { client, inserts, auditEvents } = createClient({ steward: false });

    await expect(createIntroductionFromStewardReviewAction('review-1', { supabase: client, now: NOW })).resolves.toMatchObject({ ok: false, error: 'forbidden' });
    expect(inserts).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('creates a privacy-safe audit event', async () => {
    const { client, auditEvents } = createClient({ steward: true });

    await createIntroductionFromStewardReviewAction('review-1', { supabase: client, now: NOW });

    expect(auditEvents[0]).toMatchObject({ event_type: 'introduction.created', actor_id: 'steward-1', target_id: 'intro-1', metadata: { requestId: 'request-1', matchId: 'match-1', requesterIdentityId: 'requester-1', helperIdentityId: 'helper-1', status: 'draft' } });
    expect(JSON.stringify(auditEvents[0])).not.toContain('message');
  });
});

it('sanitizes raw introduction messages from repository contexts', async () => {
  const { mapIntroductionRow } = await import('@/lib/introductions/repository');
  const mapped = mapIntroductionRow({
    id: 'intro-sensitive',
    request_id: 'request-1',
    match_id: 'match-1',
    steward_review_id: 'review-1',
    requester_identity_id: 'requester-1',
    helper_identity_id: 'helper-1',
    created_by_identity_id: 'steward-1',
    status: 'draft',
    context: {
      source: 'steward_review',
      messageContentStored: false,
      rawIntroductionMessage: 'raw private introduction',
      nested: { messageContent: 'private nested draft' },
    },
    created_at: '2026-07-07T12:00:00.000Z',
    updated_at: '2026-07-07T12:00:00.000Z',
  });

  expect(mapped.context).toEqual({
    source: 'steward_review',
    messageContentStored: false,
    nested: {},
  });
  expect(JSON.stringify(mapped)).not.toContain('raw private introduction');
  expect(JSON.stringify(mapped)).not.toContain('private nested draft');
});
