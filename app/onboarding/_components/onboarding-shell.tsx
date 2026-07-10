import * as React from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';

type OnboardingStep = {
  href: string;
  label: string;
};

type OnboardingShellProps = {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
  currentHref: string;
  steps: OnboardingStep[];
  nextHref?: string;
  nextLabel?: string;
  previousHref?: string;
  previousLabel?: string;
};

export function OnboardingShell({
  badge,
  title,
  description,
  children,
  currentHref,
  steps,
  nextHref,
  nextLabel,
  previousHref,
  previousLabel,
}: OnboardingShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between rounded-full bg-white/70 px-5 py-3 shadow-soft ring-1 ring-black/5 backdrop-blur">
        <Link href="/" className="text-sm font-bold uppercase tracking-[0.24em] text-trust">
          Trusted Introductions
        </Link>
        <Badge className="hidden bg-white sm:inline-flex">M2 onboarding placeholder</Badge>
      </header>

      <section className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[0.75fr_1.25fr]">
        <Card className="h-fit">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-trust">Onboarding flow</p>
          <ol className="mt-6 space-y-3" aria-label="Onboarding placeholder steps">
            {steps.map((step, index) => {
              const isCurrent = step.href === currentHref;

              return (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={
                      isCurrent
                        ? 'flex items-center gap-3 rounded-2xl bg-sage px-4 py-3 text-sm font-semibold text-trust ring-1 ring-trust/10'
                        : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-ink/65 hover:bg-white/70'
                    }
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-trust ring-1 ring-black/5">
                      {index + 1}
                    </span>
                    {step.label}
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="p-8">
          <Badge>{badge}</Badge>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/70">{description}</p>
          <div className="mt-8">{children}</div>
          {(previousHref || nextHref) && (
            <nav className="mt-10 flex flex-col gap-3 border-t border-black/5 pt-6 sm:flex-row sm:justify-between" aria-label="Placeholder onboarding navigation">
              {previousHref && previousLabel ? (
                <Link href={previousHref} className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-trust ring-1 ring-trust/15 hover:bg-sage/30">
                  ← {previousLabel}
                </Link>
              ) : <span />}
              {nextHref && nextLabel ? (
                <Link href={nextHref} className="inline-flex items-center justify-center rounded-full bg-trust px-5 py-3 text-sm font-semibold text-white shadow-soft hover:bg-trust/90">
                  {nextLabel} →
                </Link>
              ) : null}
            </nav>
          )}
        </Card>
      </section>
    </main>
  );
}
