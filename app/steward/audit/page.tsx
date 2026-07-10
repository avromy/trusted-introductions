import React from 'react';

import { Card, Badge } from '@/components/ui';
import { requireStewardOrAdmin } from '@/lib/auth/steward';
import { listAuditDashboardEvents, type AuditDashboardClient } from '@/lib/audit/dashboard';
import { createClient } from '@/lib/supabase/server';

type AuditSearchParams = Record<string, string | string[] | undefined>;

function value(searchParams: AuditSearchParams, key: string): string | undefined {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function MetadataList({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return <span className="text-ink/50">No safe metadata</span>;
  return <dl className="flex flex-wrap gap-2">{entries.map(([key, val]) => <div key={key} className="rounded-2xl bg-sage/50 px-3 py-2"><dt className="text-[0.65rem] uppercase tracking-wide text-trust">{key}</dt><dd className="text-xs text-ink">{String(val)}</dd></div>)}</dl>;
}

export default async function AuditDashboardPage({ searchParams }: { searchParams: Promise<AuditSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const supabase = createClient() as unknown as NonNullable<Parameters<typeof requireStewardOrAdmin>[0]> & AuditDashboardClient;

  try {
    await requireStewardOrAdmin(supabase);
  } catch {
    return <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16"><Card><Badge>Unauthorized</Badge><h1 className="mt-4 text-3xl font-bold text-ink">Steward access required</h1><p className="mt-3 text-ink/70">Only stewards and admins can review privacy-safe audit metadata.</p></Card></main>;
  }

  const page = await listAuditDashboardEvents(supabase, {
    eventType: value(resolvedSearchParams, 'eventType'),
    actorType: value(resolvedSearchParams, 'actorType'),
    targetType: value(resolvedSearchParams, 'targetType'),
    startDate: value(resolvedSearchParams, 'startDate'),
    endDate: value(resolvedSearchParams, 'endDate'),
    page: Number(value(resolvedSearchParams, 'page')),
    pageSize: Number(value(resolvedSearchParams, 'pageSize')),
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="mb-8"><Badge>Operations</Badge><h1 className="mt-4 text-4xl font-bold text-ink">Audit review dashboard</h1><p className="mt-3 max-w-3xl text-ink/70">Review bounded, privacy-safe audit metadata. Private notes, resumes, contact details, raw submissions, messages, and secrets are excluded.</p></div>
      <Card className="mb-6"><h2 className="text-lg font-semibold text-ink">Filters</h2><form className="mt-4 grid gap-3 md:grid-cols-3"><input name="eventType" defaultValue={page.filters.eventType ?? ''} placeholder="event type" className="rounded-2xl border border-sage px-3 py-2" /><input name="actorType" defaultValue={page.filters.actorType ?? ''} placeholder="actor type" className="rounded-2xl border border-sage px-3 py-2" /><input name="targetType" defaultValue={page.filters.targetType ?? ''} placeholder="target type" className="rounded-2xl border border-sage px-3 py-2" /><input type="date" name="startDate" defaultValue={page.filters.startDate} className="rounded-2xl border border-sage px-3 py-2" /><input type="date" name="endDate" defaultValue={page.filters.endDate} className="rounded-2xl border border-sage px-3 py-2" /><button className="rounded-2xl bg-trust px-4 py-2 font-semibold text-white">Apply filters</button></form></Card>
      {page.events.length === 0 ? <Card><h2 className="text-2xl font-bold text-ink">No audit events found</h2><p className="mt-2 text-ink/70">Try widening the date range or removing a filter.</p></Card> : <div className="space-y-4">{page.events.map((event) => <Card key={event.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-ink/60">{new Date(event.occurredAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p><h2 className="mt-1 text-xl font-semibold text-ink">{event.eventType}</h2><p className="mt-1 text-sm text-ink/70">Actor: {event.actorType} {event.actorId ?? 'unknown'} · Target: {event.targetType} {event.targetId ?? 'none'}</p></div><Badge>{event.communityId ?? 'global'}</Badge></div><div className="mt-4"><MetadataList metadata={event.metadata} /></div></Card>)}</div>}
      <nav className="mt-6 flex items-center justify-between text-sm text-ink/70"><span>Page {page.filters.page} of {page.totalPages} · {page.totalCount} events</span><div className="flex gap-2">{page.hasPreviousPage ? <a className="rounded-xl bg-white px-3 py-2" href={`?page=${page.filters.page - 1}`}>Previous</a> : null}{page.hasNextPage ? <a className="rounded-xl bg-white px-3 py-2" href={`?page=${page.filters.page + 1}`}>Next</a> : null}</div></nav>
    </main>
  );
}
