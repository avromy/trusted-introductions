import { Card } from '@/components/ui';
import { getIntroductionById } from '@/lib/introductions/repository';

interface StewardIntroductionPageProps {
  params: { introductionId: string };
}

export default async function StewardIntroductionPage({ params }: StewardIntroductionPageProps) {
  const introduction = await getIntroductionById(params.introductionId);

  if (!introduction) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Introduction</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Introduction not found</h1>
          <p className="mt-4 text-ink/70">Check the introduction link or return to the steward workspace.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Steward introduction</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Approved introduction created</h1>
        <p className="mt-4 text-ink/70">
          This introduction was created from an approved match. No AI-generated endorsement was created and no email was sent.
        </p>
        <dl className="mt-8 grid gap-4 text-sm text-ink/80 sm:grid-cols-2">
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold text-ink">Request</dt>
            <dd className="mt-1 break-all">{introduction.request_id}</dd>
          </div>
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold text-ink">Match</dt>
            <dd className="mt-1 break-all">{introduction.match_id}</dd>
          </div>
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold text-ink">Requester</dt>
            <dd className="mt-1 break-all">{introduction.requester_identity_id}</dd>
          </div>
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold text-ink">Helper</dt>
            <dd className="mt-1 break-all">{introduction.helper_identity_id}</dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
