import { Card } from '@/components/ui';

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hasToken = Boolean(token?.trim());
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Notification preferences</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">{hasToken ? 'Confirm unsubscribe' : 'Unsubscribe link unavailable'}</h1>
        <p className="mt-4 text-ink/70">This page never displays account, identity, or delivery-address details.</p>
        {hasToken ? <form className="mt-8"><button className="rounded-2xl bg-trust px-5 py-3 font-semibold text-white" type="submit">Unsubscribe from optional messages</button></form> : null}
      </Card>
    </main>
  );
}
