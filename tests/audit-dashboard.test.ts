import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import AuditDashboardPage from '@/app/steward/audit/page';
import { listAuditDashboardEvents, normalizeAuditDashboardFilters, sanitizeAuditDashboardMetadata, type AuditDashboardClient } from '@/lib/audit/dashboard';
import type { Database } from '@/types/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';

type Row = Database['public']['Tables']['audit_events']['Row'];

const row = (overrides: Partial<Row> = {}): Row => ({
  id: 'event-1',
  actor_identity_id: 'identity-steward',
  community_id: null,
  created_at: '2026-07-01T12:00:00.000Z',
  event_type: 'invite.created',
  subject_table: 'invitations',
  subject_id: 'target-1',
  metadata: { status: 'created', inviteeEmail: 'private@example.com', privateNote: 'secret note', token: 'secret-token' },
  ...overrides,
});

function authClient(role: 'steward' | 'admin' | 'member', rows: Row[] = [row()], count = rows.length) {
  const calls: Array<[string, string]> = [];
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn((column: string, value: string) => { calls.push([column, value]); return query; }),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    range: vi.fn(async () => ({ data: rows, error: null, count })),
  };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'trusted_identities') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: { id: 'identity-steward', user_id: 'user-1', primary_email: 's@example.com', display_name: 'Steward', legal_name: null, phone: null, metadata: {}, status: 'active', created_at: '', updated_at: '' }, error: null })) };
      if (table === 'user_roles') return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: [{ id: 'role-1', identity_id: 'identity-steward', community_id: null, role, granted_by_identity_id: null, created_at: '', updated_at: '' }], error: null })) };
      return query;
    }),
  };
  return { client, query, calls };
}

describe('audit dashboard helpers', () => {
  it('applies filters and bounded pagination', async () => {
    const { client, query, calls } = authClient('steward', [row()], 60);
    const result = await listAuditDashboardEvents(client as unknown as AuditDashboardClient, { eventType: 'invite.created', targetType: 'invitations', page: 2, pageSize: 75, startDate: '2020-01-01', endDate: '2026-07-10', now: new Date('2026-07-10T00:00:00.000Z') });

    expect(result.filters.pageSize).toBe(50);
    expect(result.filters.startDate).toBe('2026-04-11');
    expect(result.hasNextPage).toBe(false);
    expect(query.range).toHaveBeenCalledWith(50, 99);
    expect(calls).toEqual([['event_type', 'invite.created'], ['subject_table', 'invitations']]);
  });

  it('excludes sensitive metadata from dashboard rows', () => {
    expect(sanitizeAuditDashboardMetadata(row().metadata)).toEqual({ status: 'created' });
  });

  it('defaults to a safe recent date window', () => {
    expect(normalizeAuditDashboardFilters({ now: new Date('2026-07-10T00:00:00.000Z') })).toMatchObject({ startDate: '2026-06-10', endDate: '2026-07-10', page: 1 });
  });
});

describe('audit dashboard page access', () => {
  it('allows steward access', async () => {
    const { client } = authClient('steward');
    vi.mocked(createClient).mockReturnValue(client as never);
    const html = renderToStaticMarkup(await AuditDashboardPage({ searchParams: {} }));
    expect(html).toContain('Audit review dashboard');
    expect(html).toContain('invite.created');
  });

  it('allows admin access', async () => {
    const { client } = authClient('admin');
    vi.mocked(createClient).mockReturnValue(client as never);
    const html = renderToStaticMarkup(await AuditDashboardPage({ searchParams: {} }));
    expect(html).toContain('Audit review dashboard');
  });

  it('rejects ordinary users explicitly', async () => {
    const { client } = authClient('member');
    vi.mocked(createClient).mockReturnValue(client as never);
    const html = renderToStaticMarkup(await AuditDashboardPage({ searchParams: {} }));
    expect(html).toContain('Steward access required');
  });

  it('renders an empty state', async () => {
    const { client } = authClient('steward', [], 0);
    vi.mocked(createClient).mockReturnValue(client as never);
    const html = renderToStaticMarkup(await AuditDashboardPage({ searchParams: {} }));
    expect(html).toContain('No audit events found');
  });
});
