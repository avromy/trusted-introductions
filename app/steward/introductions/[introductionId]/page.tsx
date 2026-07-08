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
          <p className="mt-4 text-ink/70">This steward introduction could not be found.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Steward introduction</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Introduction draft</h1>
        <p className="mt-4 text-ink/70">
          Review the privacy-safe introduction record before coordinating any off-platform message.
        </p>
        <dl className="mt-8 grid gap-4 text-sm text-ink sm:grid-cols-2">
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold">Status</dt>
            <dd className="mt-1">{introduction.status}</dd>
          </div>
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold">Request</dt>
            <dd className="mt-1 break-all">{introduction.requestId}</dd>
          </div>
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold">Requester identity</dt>
            <dd className="mt-1 break-all">{introduction.requesterIdentityId}</dd>
          </div>
          <div className="rounded-2xl bg-sage/30 p-4">
            <dt className="font-semibold">Helper identity</dt>
            <dd className="mt-1 break-all">{introduction.helperIdentityId}</dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
