import { notFound } from 'next/navigation';

import { Card } from '@/components/ui';
import { getIntroductionById, type SafeIntroductionContext } from '@/lib/introductions/repository';
import type { Json } from '@/types/supabase';

type IntroductionDetailPageProps = {
  params: {
    introductionId: string;
  };
};

function isSafeContext(value: Json): value is SafeIntroductionContext {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function formatList(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : 'Not provided';
}

export default async function IntroductionDetailPage({ params }: IntroductionDetailPageProps) {
  const introduction = await getIntroductionById(params.introductionId);

  if (!introduction) {
    notFound();
  }

  const safeContext = isSafeContext(introduction.safe_context) ? introduction.safe_context : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Steward introduction
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Introduction detail</h1>
        <p className="mt-4 text-ink/70">
          Review the safe structured context for this approved match. No email has been sent and no
          AI-generated personal endorsement is included.
        </p>

        <dl className="mt-8 grid gap-4 text-sm text-ink/80">
          <div>
            <dt className="font-semibold text-ink">Status</dt>
            <dd>{introduction.status}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Requester identity</dt>
            <dd>{introduction.requester_identity_id}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Helper identity</dt>
            <dd>{introduction.helper_identity_id}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Request</dt>
            <dd>{introduction.request_id}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Match</dt>
            <dd>{introduction.match_id}</dd>
          </div>
        </dl>

        {safeContext ? (
          <section className="mt-8 rounded-2xl border border-ink/10 bg-white/70 p-5 text-sm text-ink/80">
            <h2 className="text-lg font-semibold text-ink">Safe context</h2>
            <p className="mt-3">
              <span className="font-semibold">Headline:</span>{' '}
              {safeContext.request.headline ?? 'Not provided'}
            </p>
            <p className="mt-2">
              <span className="font-semibold">Target role:</span>{' '}
              {safeContext.request.targetRole ?? 'Not provided'}
            </p>
            <p className="mt-2">
              <span className="font-semibold">Target companies:</span>{' '}
              {formatList(safeContext.request.targetCompanies)}
            </p>
            <p className="mt-2">
              <span className="font-semibold">Target locations:</span>{' '}
              {formatList(safeContext.request.targetLocations)}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-ink/60">
              Email notification sent: no · Personal endorsement: no
            </p>
          </section>
        ) : null}
      </Card>
    </main>
  );
}
