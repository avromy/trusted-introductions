import React from 'react';
import Link from 'next/link';

import { Card } from '@/components/ui';
import { getStewardOperationsQueue, type QueueKind, type QueueItem } from '@/lib/steward/operations/queue';

const LABELS: Record<QueueKind, string> = {
  requests_awaiting_match_review: 'Requests awaiting match review',
  reviews_needing_information: 'Reviews needing information',
  approved_matches_awaiting_introduction: 'Approved matches awaiting introduction',
  introductions_needing_follow_up: 'Introductions needing follow-up',
  introductions_awaiting_outcome: 'Introductions awaiting outcome',
};

function StateCard({ title, body }: { title: string; body: string }) {
  return <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16"><Card><p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Steward operations</p><h1 className="mt-3 text-3xl font-bold text-ink">{title}</h1><p className="mt-4 text-ink/70">{body}</p></Card></main>;
}

function QueueRow({ item }: { item: QueueItem }) {
  return <li className="rounded-2xl border border-trust/10 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-trust">{LABELS[item.kind]}</p><h2 className="mt-2 text-lg font-semibold text-ink">{item.title}</h2><p className="mt-1 text-sm text-ink/65">{item.subtitle}</p><p className="mt-2 text-xs text-ink/50">Status: {item.status} · Updated {item.createdAt}</p></div><Link className="rounded-full bg-trust px-4 py-2 text-center text-sm font-semibold text-white" href={item.href}>Open workflow</Link></div></li>;
}

export default async function StewardOperationsPage({ searchParams }: { searchParams?: { limit?: string; offset?: string } }) {
  const result = await getStewardOperationsQueue(searchParams ?? {});
  if (!result.ok) {
    if (result.state === 'unauthorized') return <StateCard title="Steward access required" body="Only active stewards and admins can view the operational queue." />;
    return <StateCard title="Queue unavailable" body={result.message} />;
  }
  const { queue } = result;
  const nextOffset = queue.pagination.offset + queue.pagination.limit;
  const previousOffset = Math.max(0, queue.pagination.offset - queue.pagination.limit);
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="mb-6 rounded-full bg-trust/10 px-4 py-2 text-sm font-semibold text-trust">Privacy-safe steward operational queue</div><Card className="p-8"><h1 className="text-3xl font-bold text-ink">Steward operations</h1><p className="mt-3 max-w-3xl text-ink/70">Actionable queue summaries use existing request, review, match, introduction, follow-up, and outcome records without exposing private notes, resumes, hidden contact information, or notification delivery status.</p><dl className="mt-8 grid gap-4 md:grid-cols-5">{Object.entries(queue.counts).map(([kind, count]) => <div key={kind} className="rounded-2xl bg-sage/30 p-4"><dt className="text-sm font-semibold text-ink">{LABELS[kind as QueueKind]}</dt><dd className="mt-2 text-3xl font-bold text-trust">{count}</dd></div>)}</dl></Card><section className="mt-8" aria-labelledby="queue-heading"><h2 id="queue-heading" className="text-2xl font-bold text-ink">Actionable work</h2>{queue.items.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-trust/20 bg-white/70 p-8 text-ink/70">No operational queue items need steward action right now.</div> : <ul className="mt-4 grid gap-4">{queue.items.map((item) => <QueueRow key={item.id} item={item} />)}</ul>}<nav className="mt-6 flex gap-3" aria-label="Queue pagination">{queue.pagination.offset > 0 ? <Link className="rounded-full border border-trust/20 px-4 py-2 text-sm font-semibold text-trust" href={`/steward/operations?limit=${queue.pagination.limit}&offset=${previousOffset}`}>Previous</Link> : null}{queue.pagination.hasMore ? <Link className="rounded-full border border-trust/20 px-4 py-2 text-sm font-semibold text-trust" href={`/steward/operations?limit=${queue.pagination.limit}&offset=${nextOffset}`}>Next</Link> : null}</nav></section></main>;
}
