'use client';

import React from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Button, Card, Input } from '@/components/ui';
import { HELPER_CAPABILITY_CATEGORY_VALUES } from '@/lib/matching/helper-capability';
import { submitHelperCapabilities } from './actions';
import { initialHelperCapabilitiesFormState, type HelperCapabilitiesFormState } from './form-state';

const categoryOptions: Record<
  (typeof HELPER_CAPABILITY_CATEGORY_VALUES)[number],
  { label: string; description: string }
> = {
  career_navigation: {
    label: 'Career navigation',
    description: 'Role exploration, transitions, and planning next steps.',
  },
  resume_review: {
    label: 'Resume review',
    description: 'Feedback on resumes, profiles, or cover letters.',
  },
  interview_practice: {
    label: 'Interview practice',
    description: 'Mock interviews, interview prep, and debriefs.',
  },
  network_introduction: {
    label: 'Network introductions',
    description: 'Warm introductions to relevant people or communities.',
  },
  industry_insight: {
    label: 'Industry insight',
    description: 'Context on sectors, teams, and hiring norms.',
  },
  portfolio_review: {
    label: 'Portfolio review',
    description: 'Project, case study, or work sample feedback.',
  },
  accountability: {
    label: 'Accountability',
    description: 'Check-ins, goals, and momentum support.',
  },
  resource_navigation: {
    label: 'Resource navigation',
    description: 'Programs, services, learning paths, and referrals.',
  },
};

const availabilityOptions = [
  { value: 'available', label: 'Available', helper: 'Open to regular introductions this week.' },
  { value: 'limited', label: 'Limited', helper: 'Can help selectively or on a slower cadence.' },
  {
    value: 'unavailable',
    label: 'Unavailable',
    helper: 'Pause new introductions until a future date.',
  },
] as const;

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? 'Saving capabilities…' : 'Save helper capabilities'}
    </Button>
  );
}

function FormMessage({ state }: { state: HelperCapabilitiesFormState }) {
  if (!state.message && state.errors.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={
        state.ok
          ? 'rounded-2xl bg-sage/40 p-4 text-sm font-medium text-trust'
          : 'rounded-2xl bg-rust/10 p-4 text-sm font-medium text-rust'
      }
      role={state.ok ? 'status' : 'alert'}
    >
      {state.message ? <p>{state.message}</p> : null}
      {state.errors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function HelperCapabilitiesForm() {
  const [state, formAction] = useFormState(
    submitHelperCapabilities,
    initialHelperCapabilitiesFormState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-8">
      <fieldset className="space-y-3">
        <div>
          <legend className="text-base font-semibold text-ink">How you can help</legend>
          <p className="mt-1 text-sm text-ink/60">
            Choose every support area you are comfortable offering.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {HELPER_CAPABILITY_CATEGORY_VALUES.map((category) => (
            <label
              key={category}
              className="flex gap-3 rounded-2xl border border-trust/15 bg-white p-4 text-sm text-ink shadow-sm transition hover:border-trust/40"
            >
              <input
                className="mt-1 h-4 w-4 accent-trust"
                type="checkbox"
                name="categories"
                value={category}
              />
              <span>
                <span className="block font-semibold">{categoryOptions[category].label}</span>
                <span className="mt-1 block text-xs leading-5 text-ink/60">
                  {categoryOptions[category].description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Card className="bg-cream p-5 shadow-none">
        <div className="grid gap-5 sm:grid-cols-[1.2fr_0.8fr]">
          <label className="block text-sm font-semibold text-ink">
            Availability
            <select
              className="mt-2 h-12 w-full rounded-2xl border border-trust/15 bg-white px-4 text-sm outline-none focus:border-trust focus:ring-4 focus:ring-trust/10"
              name="availabilityStatus"
              defaultValue="limited"
            >
              {availabilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.helper}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink">
            Weekly intro capacity
            <Input
              className="mt-2"
              min={0}
              name="weeklyIntroCapacity"
              type="number"
              defaultValue={1}
            />
            <span className="mt-1 block text-xs font-normal text-ink/60">
              Use 0 only when unavailable.
            </span>
          </label>
        </div>
        <label className="mt-5 block text-sm font-semibold text-ink">
          Next available date
          <Input className="mt-2" name="nextAvailableAt" type="date" />
          <span className="mt-1 block text-xs font-normal text-ink/60">
            Optional. Helpful when you are limited or unavailable.
          </span>
        </label>
      </Card>

      <section className="grid gap-4" aria-labelledby="matching-labels-heading">
        <div>
          <h2 id="matching-labels-heading" className="text-base font-semibold text-ink">
            Matching labels
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Comma-separated labels help stewards route high-fit requests.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-ink">
            Industries
            <Input className="mt-2" name="industries" placeholder="Fintech, climate" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Geographies
            <Input className="mt-2" name="geographies" placeholder="US, Canada, remote" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Languages
            <Input className="mt-2" name="languages" placeholder="English, Spanish" />
          </label>
        </div>
      </section>

      <label className="block rounded-3xl border border-dashed border-trust/30 bg-white p-5 text-sm font-semibold text-ink">
        <span className="flex flex-wrap items-center gap-2">
          Private steward notes{' '}
          <span className="rounded-full bg-rust/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-rust">
            Private
          </span>
        </span>
        <span className="mt-2 block text-xs font-normal leading-5 text-ink/60">
          Only stewards should use these notes. They are not included in public helper capability
          output.
        </span>
        <textarea
          className="mt-3 min-h-32 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
          name="privateNotes"
          placeholder="Constraints, sensitive context, or preferences for steward review only."
        />
      </label>

      <FormMessage state={state} />
      <SaveButton />
    </form>
  );
}
