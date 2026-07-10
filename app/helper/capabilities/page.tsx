import React from 'react';
import { Card } from '@/components/ui';
import { HelperCapabilitiesForm } from './helper-capabilities-form';

export default function HelperCapabilitiesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      <Card className="overflow-hidden">
        <div className="rounded-3xl bg-gradient-to-br from-sage/60 to-white p-6 ring-1 ring-trust/10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
            Helper intake
          </p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Describe how you can help</h1>
          <p className="mt-4 max-w-2xl text-ink/70">
            Give stewards a clear, private-aware snapshot of your support areas, availability,
            capacity, and matching labels so they can make thoughtful introductions.
          </p>
        </div>
        <HelperCapabilitiesForm />
      </Card>
    </main>
  );
}
