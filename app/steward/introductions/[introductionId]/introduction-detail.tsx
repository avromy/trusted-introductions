import React from 'react';

import { Card } from '@/components/ui';
import type { Introduction } from '@/lib/introductions/repository';
import type { Json } from '@/types/supabase';

export type DetailState = 'empty' | 'error' | 'unauthorized';

type SafeContextEntry = {
  label: string;
  value: string;
};

const CONTEXT_LABELS: Record<string, string> = {
  requestHeadline: 'Request headline',
  targetRole: 'Target role',
  targetCompanies: 'Target companies',
  targetLocations: 'Target locations',
  remotePreference: 'Remote preference',
  matchReasons: 'Match rationale',
  helperCategories: 'Helper support areas',
  helperAvailability: 'Helper availability',
  stewardNotes: 'Steward-safe notes',
};

function isJsonRecord(value: Json): value is { [key: string]: Json } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function formatContextValue(value: Json): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const formattedItems = value
      .map((item) => formatContextValue(item))
      .filter((item): item is string => Boolean(item));
    return formattedItems.length > 0 ? formattedItems.join(', ') : null;
  }
  return null;
}

function toLabel(key: string): string {
  if (CONTEXT_LABELS[key]) return CONTEXT_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

export function getSafeIntroductionContextEntries(context: Json): SafeContextEntry[] {
  if (!isJsonRecord(context)) return [];
  return Object.entries(context)
    .map(([key, value]) => ({ label: toLabel(key), value: formatContextValue(value) }))
    .filter((entry): entry is SafeContextEntry => Boolean(entry.value));
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-sage/30 p-4">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="mt-1 break-words text-ink/75">{value}</dd>
    </div>
  );
}

export function StateCard({ state }: { state: DetailState }) {
  const copy = {
    empty: {
      eyebrow: 'Introduction unavailable',
      title: 'Introduction not found',
      body: 'This steward introduction could not be found. Confirm the link and avoid sharing any off-platform context until the record exists.',
    },
    error: {
      eyebrow: 'Introduction unavailable',
      title: 'We could not load this introduction',
      body: 'Try again in a moment. If this keeps happening, ask an admin to review the audit trail using the introduction id only.',
    },
    unauthorized: {
      eyebrow: 'Access restricted',
      title: 'You are not authorized to review this introduction',
      body: 'Only active stewards and admins can view introduction review details. Sign in with an authorized account to continue.',
    },
  }[state];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">{copy.title}</h1>
        <p className="mt-4 text-ink/70">{copy.body}</p>
      </Card>
    </main>
  );
}

export function IntroductionDetail({ introduction }: { introduction: Introduction }) {
  const safeContext = getSafeIntroductionContextEntries(introduction.context);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="mb-6 rounded-full bg-trust/10 px-4 py-2 text-sm font-semibold text-trust">
        AI does not write personal endorsements. Stewards use only consented, factual context when
        coordinating introductions.
      </div>
      <Card className="p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Steward introduction
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-ink">Introduction review</h1>
            <p className="mt-3 max-w-2xl text-ink/70">
              Review the privacy-safe introduction record before coordinating any off-platform
              message.
            </p>
          </div>
          <span className="rounded-full bg-sage px-4 py-2 text-sm font-semibold text-trust">
            {introduction.status}
          </span>
        </div>
        <section className="mt-8" aria-labelledby="people-heading">
          <h2 id="people-heading" className="text-xl font-semibold text-ink">
            Requester and helper
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <MetadataItem label="Requester identity" value={introduction.requesterIdentityId} />
            <MetadataItem label="Helper identity" value={introduction.helperIdentityId} />
          </dl>
        </section>
        <section className="mt-8" aria-labelledby="records-heading">
          <h2 id="records-heading" className="text-xl font-semibold text-ink">
            Request, match, and audit-safe metadata
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <MetadataItem label="Request" value={introduction.requestId} />
            <MetadataItem label="Match" value={introduction.matchId} />
            <MetadataItem label="Steward review" value={introduction.stewardReviewId} />
            <MetadataItem label="Created by" value={introduction.createdByIdentityId} />
            <MetadataItem label="Created" value={introduction.createdAt} />
            <MetadataItem label="Last updated" value={introduction.updatedAt} />
          </dl>
        </section>
        <section className="mt-8" aria-labelledby="context-heading">
          <h2 id="context-heading" className="text-xl font-semibold text-ink">
            Safe introduction context
          </h2>
          {safeContext.length > 0 ? (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              {safeContext.map((entry) => (
                <MetadataItem key={entry.label} label={entry.label} value={entry.value} />
              ))}
            </dl>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-trust/20 bg-white/60 p-5 text-sm text-ink/70">
              No steward-safe context has been attached yet. Do not infer personal endorsements or
              private details from this record.
            </div>
          )}
        </section>
      </Card>
    </main>
  );
}
