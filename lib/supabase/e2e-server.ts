import { cookies } from 'next/headers';

const NOW = '2026-07-10T00:00:00.000Z';

type Row = Record<string, any>;

const seed = () => ({
  trusted_identities: [
    { id: 'e2e-steward-identity', user_id: 'e2e-steward-user', status: 'active', primary_email: 'e2e+steward@example.test' },
    { id: 'e2e-seeker-identity', user_id: 'e2e-seeker-user', status: 'active', primary_email: 'e2e+seeker@example.test' },
  ],
  user_roles: [
    { identity_id: 'e2e-steward-identity', role: 'steward', community_id: null },
    { identity_id: 'e2e-seeker-identity', role: 'member', community_id: null },
  ],
  job_seeker_requests: [
    { id: 'e2e-request-with-matches', identity_id: 'e2e-requester-identity', status: 'open', headline: 'Climate product leader seeking warm introductions', target_role: 'network_introduction', target_companies: ['ClimateCo'], target_locations: ['Remote'], remote_preference: null, salary_expectation: null, work_authorization: null, notes: null, resume_url: null, opened_at: NOW, closed_at: null, created_at: NOW, updated_at: NOW },
    { id: 'e2e-request-empty', identity_id: 'e2e-requester-identity', status: 'open', headline: 'No helpers yet', target_role: 'career_navigation', target_companies: [], target_locations: ['Remote'], remote_preference: null, salary_expectation: null, work_authorization: null, notes: null, resume_url: null, opened_at: NOW, closed_at: null, created_at: NOW, updated_at: NOW },
  ],
  helper_capabilities: [
    { id: 'e2e-capability-approved', identity_id: 'e2e-helper-approved', categories: ['network_introduction'], availability_status: 'available', weekly_intro_capacity: 2, next_available_at: null, industries: ['climate'], geographies: ['Remote'], languages: [], private_notes: 'Sensitive helper note', created_at: NOW, updated_at: NOW },
    { id: 'e2e-capability-new', identity_id: 'e2e-helper-new', categories: ['network_introduction'], availability_status: 'available', weekly_intro_capacity: 1, next_available_at: null, industries: ['climate'], geographies: ['Remote'], languages: [], private_notes: null, created_at: NOW, updated_at: NOW },
  ],
  match_suggestions: [
    { id: 'e2e-match-approved', request_id: 'e2e-request-with-matches', helper_identity_id: 'e2e-helper-approved', helper_capability_id: 'e2e-capability-approved', rank: 1, score: 92, reasons: ['Matches desired help: network_introduction.', 'Matches communities: Remote.'], metadata: {}, created_at: NOW, updated_at: NOW },
    { id: 'e2e-match-rejected', request_id: 'e2e-request-with-matches', helper_identity_id: 'e2e-helper-rejected', helper_capability_id: 'e2e-capability-rejected', rank: 2, score: 64, reasons: ['Partial company fit.'], metadata: {}, created_at: NOW, updated_at: NOW },
    { id: 'e2e-match-needs-info', request_id: 'e2e-request-with-matches', helper_identity_id: 'e2e-helper-info', helper_capability_id: 'e2e-capability-info', rank: 3, score: 51, reasons: [], metadata: {}, created_at: NOW, updated_at: NOW },
  ],
  steward_reviews: [
    { id: 'e2e-review-approved', request_id: 'e2e-request-with-matches', steward_identity_id: 'e2e-steward-identity', subject_identity_id: 'e2e-helper-approved', match_suggestion_id: 'e2e-match-approved', status: 'pending', decision_reason: null, decided_at: null, created_at: NOW, updated_at: NOW },
    { id: 'e2e-review-rejected', request_id: 'e2e-request-with-matches', steward_identity_id: 'e2e-steward-identity', subject_identity_id: 'e2e-helper-rejected', match_suggestion_id: 'e2e-match-rejected', status: 'pending', decision_reason: null, decided_at: null, created_at: NOW, updated_at: NOW },
    { id: 'e2e-review-needs-info', request_id: 'e2e-request-with-matches', steward_identity_id: 'e2e-steward-identity', subject_identity_id: 'e2e-helper-info', match_suggestion_id: 'e2e-match-needs-info', status: 'pending', decision_reason: null, decided_at: null, created_at: NOW, updated_at: NOW },
    { id: 'e2e-review-finalized', request_id: 'e2e-request-with-matches', steward_identity_id: 'e2e-steward-identity', subject_identity_id: 'e2e-helper-final', match_suggestion_id: null, status: 'approved', decision_reason: 'Already approved', decided_at: NOW, created_at: NOW, updated_at: NOW },
  ],
  introductions: [
    { id: 'e2e-introduction-safe', request_id: 'e2e-request-with-matches', match_id: 'e2e-match-approved', steward_review_id: 'e2e-review-approved', requester_identity_id: 'e2e-requester-identity', helper_identity_id: 'e2e-helper-approved', created_by_identity_id: 'e2e-steward-identity', status: 'draft', context: { source: 'steward_review', stewardReviewId: 'e2e-review-approved', messageContentStored: false, rawIntroductionMessage: 'SECRET RAW MESSAGE' }, created_at: NOW, updated_at: NOW },
  ],
  audit_events: [],
});

let db = seed();

function role() { return cookies().get('trusted-introductions-e2e-role')?.value ?? 'seeker'; }
function userId() { return `e2e-${role()}-user`; }

function tableRows(table: keyof ReturnType<typeof seed>) { return (db[table] as Row[]); }

class Builder {
  filters: [string, any][] = []; sort?: { column: string; ascending: boolean }; payload: any; op?: 'insert'|'update'|'delete';
  constructor(private table: keyof ReturnType<typeof seed>) {}
  select() { return this; }
  eq(c: string, v: any) { this.filters.push([c, v]); return this; }
  order(column: string, options: { ascending: boolean }) { this.sort = { column, ascending: options.ascending }; return this.exec(); }
  insert(payload: any) { this.op = 'insert'; this.payload = payload; return this; }
  update(payload: any) { this.op = 'update'; this.payload = payload; return this; }
  delete() { this.op = 'delete'; return this; }
  single() { return this.exec().then((r) => ({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error })); }
  maybeSingle() { return this.single(); }
  then(a: any, b: any) { return this.exec().then(a, b); }
  async exec() {
    let rows = tableRows(this.table);
    if (this.op === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p, i) => ({ id: p.id ?? `e2e-${this.table}-${Date.now()}-${i}`, created_at: NOW, updated_at: NOW, ...p }));
      rows.push(...items); return { data: Array.isArray(this.payload) ? items : items[0], error: null };
    }
    const matches = (r: Row) => this.filters.every(([c,v]) => r[c] === v);
    if (this.op === 'update') rows.forEach((r) => { if (matches(r)) Object.assign(r, this.payload, { updated_at: NOW }); });
    if (this.op === 'delete') db[this.table] = rows.filter((r) => !matches(r)) as any;
    let data = tableRows(this.table).filter(matches);
    if (this.sort) data = [...data].sort((a,b) => (a[this.sort!.column] > b[this.sort!.column] ? 1 : -1) * (this.sort!.ascending ? 1 : -1));
    return { data, error: null };
  }
}

export function createE2EServerClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: userId(), email: `e2e+${role()}@example.test` } }, error: null }) },
    from(table: keyof ReturnType<typeof seed>) { return new Builder(table); },
  };
}
