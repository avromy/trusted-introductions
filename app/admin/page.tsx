import { Card } from '@/components/ui';

export default function PlaceholderPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">M1 placeholder</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Admin</h1>
        <p className="mt-4 text-ink/70">
          This route is reserved for the approved product workflow. Business logic will be implemented in a future milestone.
        </p>
      </Card>
    </main>
  );
}
