import { notFound } from 'next/navigation';

import { Card } from '@/components/ui';
import { getIntroductionById } from '@/lib/introductions/repository';

interface IntroductionPageProps {
  params: {
    introductionId: string;
  };
}

function formatStatus(status: string): string {
  return status.replaceAll('_', ' ');
}

export default async function StewardIntroductionPage({ params }: IntroductionPageProps) {
  const introduction = await getIntroductionById(params.introductionId);

  if (!introduction) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Steward introduction
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Introduction workspace</h1>
        <p className="mt-4 text-ink/70">
          Review the steward-approved match, prepare the warm introduction, and track whether it has
          been sent.
        </p>

        <dl className="mt-8 grid gap-4 text-sm text-ink/80 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Status</dt>
            <dd className="capitalize">{formatStatus(introduction.status)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Approved match</dt>
            <dd>{introduction.matchId}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Requester</dt>
            <dd>{introduction.requesterIdentityId}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Helper</dt>
            <dd>{introduction.helperIdentityId}</dd>
          </div>
        </dl>

        {introduction.stewardNote ? (
          <section className="mt-6 rounded-2xl bg-sage/30 p-4 text-sm text-ink/80">
            <h2 className="font-semibold text-ink">Steward note</h2>
            <p className="mt-2">{introduction.stewardNote}</p>
          </section>
        ) : null}
      </Card>
    </main>
  );
}
