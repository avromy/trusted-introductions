import { describe, expect, it, vi } from 'vitest';
import { createStewardReviewAction, decideStewardReviewAction, type StewardReviewActionClient } from '@/lib/matching/steward-review-actions';
import { createStewardReview, listStewardReviewsForRequest, mapStewardReviewRow, type StewardReviewRow } from '@/lib/matching/steward-review-repository';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function row(overrides: Partial<StewardReviewRow> = {}): StewardReviewRow {
  return {
    id: 'review-1',
    request_id: 'request-1',
    steward_identity_id: 'steward-1',
    subject_identity_id: 'helper-1',
    match_suggestion_id: 'suggestion-1',
    status: 'pending',
    decision_reason: null,
    decided_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function createClient(options: { steward: boolean; review?: StewardReviewRow }) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const review = options.review ?? row();

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: { id: 'steward-1', status: 'active', user_id: 'user-1' }, error: null })) };
      }
      if (table === 'user_roles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: options.steward ? [{ role: 'steward', community_id: null }] : [{ role: 'member', community_id: null }], error: null })) };
      }
      if (table === 'audit_events') {
        return { insert: vi.fn(async (payload) => { auditEvents.push(payload); return { error: null }; }) };
      }
      if (table === 'steward_reviews') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn((payload) => { inserts.push(payload); return builder; }),
          update: vi.fn((payload) => { updates.push(payload); return builder; }),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(async () => ({ data: [review], error: null })),
          single: vi.fn(async () => ({ data: { ...review, ...(updates.at(-1) as object | undefined) }, error: null })),
          maybeSingle: vi.fn(async () => ({ data: review, error: null })),
        };
        return builder;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  } as unknown as StewardReviewActionClient;

  return { client, inserts, updates, auditEvents };
}

describe('steward review repository helpers', () => {
  it('maps, creates, and lists steward review rows', async () => {
    const { client, inserts } = createClient({ steward: true });

    expect(mapStewardReviewRow(row())).toMatchObject({ requestId: 'request-1', stewardIdentityId: 'steward-1', status: 'pending' });
    await expect(createStewardReview({ requestId: ' request-1 ', stewardIdentityId: ' steward-1 ', subjectIdentityId: ' helper-1 ' }, client)).resolves.toMatchObject({ id: 'review-1' });
    await expect(listStewardReviewsForRequest(' request-1 ', client)).resolves.toHaveLength(1);
    expect(inserts[0]).toMatchObject({ request_id: 'request-1', steward_identity_id: 'steward-1', subject_identity_id: 'helper-1', status: 'pending' });
  });
});

describe('createStewardReviewAction', () => {
  it('requires steward authorization before creating reviews', async () => {
    const { client, inserts, auditEvents } = createClient({ steward: false });

    await expect(
      createStewardReviewAction(
        { requestId: 'request-1', stewardIdentityId: 'steward-1', subjectIdentityId: 'helper-1' },
        { supabase: client, now: NOW },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' });
    expect(inserts).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('does not allow creating reviews assigned to another steward', async () => {
    const { client, inserts, auditEvents } = createClient({ steward: true });

    const result = await createStewardReviewAction(
      { requestId: 'request-1', stewardIdentityId: 'steward-other', subjectIdentityId: 'helper-1' },
      { supabase: client, now: NOW },
    );

    expect(result).toMatchObject({ ok: false, error: 'forbidden' });
    expect(inserts).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });
});

describe('decideStewardReviewAction', () => {
  it('requires steward authorization', async () => {
    const { client, updates, auditEvents } = createClient({ steward: false });

    await expect(decideStewardReviewAction('review-1', 'approved', { supabase: client, now: NOW })).resolves.toMatchObject({ ok: false, error: 'forbidden' });
    expect(updates).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('blocks decisions from stewards who are not assigned to the review', async () => {
    const { client, updates, auditEvents } = createClient({
      steward: true,
      review: row({ steward_identity_id: 'steward-other' }),
    });

    await expect(
      decideStewardReviewAction('review-1', 'approved', { supabase: client, now: NOW }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid_decision' });
    expect(updates).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('persists decisions and emits safe audit metadata', async () => {
    const { client, updates, auditEvents } = createClient({ steward: true });

    const result = await decideStewardReviewAction('review-1', 'rejected', { supabase: client, now: NOW, decisionReason: 'Private reason' });

    expect(result).toMatchObject({ ok: true, review: { status: 'rejected', decisionReason: 'Private reason' } });
    expect(updates[0]).toMatchObject({ status: 'rejected', decision_reason: 'Private reason', decided_at: NOW.toISOString() });
    expect(auditEvents[0]).toMatchObject({ event_type: 'steward_review.rejected', actor_id: 'steward-1', target_id: 'review-1' });
    expect(JSON.stringify(auditEvents[0])).not.toContain('Private reason');
  });
});
