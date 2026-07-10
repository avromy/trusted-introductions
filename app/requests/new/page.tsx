import React from 'react';
import { Card } from '@/components/ui';

import { JobSeekerRequestForm } from './request-form';

export default function NewJobSeekerRequestPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      <Card className="p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">
          Job seeker intake
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Request trusted introductions</h1>
        <p className="mt-4 max-w-2xl text-ink/70">
          Share the role, companies, and context helpers need to identify high-signal introductions.
          Your steward will use this structured request to decide where a warm introduction is most
          likely to help.
        </p>
        <JobSeekerRequestForm />
      </Card>
    </main>
  );
}
