'use client';

import React from 'react';
import * as ReactDom from 'react-dom';

import { Button, Input } from '@/components/ui';

import { submitJobSeekerRequest, type JobSeekerRequestFormState } from './actions';
import type { CreateJobSeekerRequestActionResult } from '@/lib/matching/job-seeker-actions';

const initialState: JobSeekerRequestFormState = { ok: null };

type FormStateHook = (
  action: (
    previousState: JobSeekerRequestFormState,
    formData: FormData,
  ) => Promise<CreateJobSeekerRequestActionResult>,
  initialState: JobSeekerRequestFormState,
) => [JobSeekerRequestFormState, (formData: FormData) => void];

const useCompatibleFormStatus =
  'useFormStatus' in ReactDom
    ? (ReactDom.useFormStatus as unknown as () => { pending: boolean })
    : () => ({ pending: false });

const useCompatibleFormState =
  'useFormState' in ReactDom
    ? (ReactDom.useFormState as unknown as FormStateHook)
    : (action: Parameters<FormStateHook>[0], state: Parameters<FormStateHook>[1]) =>
        [state, action] as unknown as ReturnType<FormStateHook>;

const fieldSections = [
  {
    title: 'Opportunity focus',
    description: 'Start with the signal a steward can quickly scan before looking for helpers.',
    fields: [
      {
        name: 'headline',
        label: 'Request headline',
        placeholder: 'Seeking warm intros for senior product roles',
        helper: 'One sentence that makes the ask easy to route.',
        required: true,
      },
      {
        name: 'targetRole',
        label: 'Target role',
        placeholder: 'Senior Product Manager',
        helper: 'Use the role title you want helpers to recognize.',
        required: true,
      },
    ],
  },
  {
    title: 'Intro targets',
    description:
      'Comma-separated lists keep the request structured without adding unsupported fields.',
    fields: [
      {
        name: 'targetCompanies',
        label: 'Target companies',
        placeholder: 'Acme, Globex, Initech',
        helper: 'Optional. Separate company names with commas.',
      },
      {
        name: 'targetLocations',
        label: 'Target locations',
        placeholder: 'Remote, New York, San Francisco',
        helper: 'Optional. Include remote, cities, or regions.',
      },
      {
        name: 'remotePreference',
        label: 'Remote preference',
        placeholder: 'Remote-first or hybrid',
        helper: 'Optional. Clarify flexibility so helpers route better matches.',
      },
    ],
  },
  {
    title: 'Candidate context',
    description: 'Share only the details needed to evaluate fit and make respectful introductions.',
    fields: [
      {
        name: 'salaryExpectation',
        label: 'Salary expectation',
        placeholder: '$140k+',
        helper: 'Optional. Use a range or minimum if helpful.',
      },
      {
        name: 'workAuthorization',
        label: 'Work authorization',
        placeholder: 'US citizen, H-1B, etc.',
        helper: 'Optional. Add constraints a steward should know before routing.',
      },
      {
        name: 'resumeUrl',
        label: 'Resume URL',
        placeholder: 'https://example.com/resume.pdf',
        helper: 'Optional. Link to a shareable resume or profile.',
      },
    ],
  },
];

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;

  return (
    <p className="mt-2 text-sm font-medium text-red-700" role="alert">
      {errors.join(' ')}
    </p>
  );
}

function SubmitButton() {
  const { pending } = useCompatibleFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Submitting request…' : 'Submit seeker request'}
    </Button>
  );
}

export function JobSeekerRequestForm() {
  const [state, formAction] = useCompatibleFormState(submitJobSeekerRequest, initialState);
  const isSuccess = state.ok === true;
  const formErrors = state.ok === false && state.error === 'validation' ? state.errors : {};

  return (
    <div className="mt-8 space-y-6">
      {isSuccess ? (
        <div
          className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
          role="status"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Request submitted
          </p>
          <h2 className="mt-2 text-xl font-bold">
            Your introduction request is ready for steward review.
          </h2>
          <p className="mt-2 text-sm text-emerald-900/80">
            We saved “{state.request.headline}” and will use the supported request details to route
            high-signal helpers.
          </p>
        </div>
      ) : null}

      {state.ok === false && state.error !== 'validation' ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="space-y-8" noValidate>
        <input type="hidden" name="status" value="open" />
        {fieldSections.map((section) => (
          <section
            key={section.title}
            className="rounded-3xl border border-trust/10 bg-white/70 p-5"
          >
            <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
            <p className="mt-1 text-sm text-ink/65">{section.description}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {section.fields.map((field) => (
                <label key={field.name} className="block text-sm font-medium text-ink">
                  <span>
                    {field.label}{' '}
                    {'required' in field && field.required ? (
                      <span className="text-red-700">*</span>
                    ) : (
                      <span className="text-ink/45">(optional)</span>
                    )}
                  </span>
                  <Input
                    aria-describedby={`${field.name}-helper`}
                    aria-invalid={Boolean(formErrors[field.name]?.length)}
                    className="mt-2"
                    name={field.name}
                    placeholder={field.placeholder}
                    required={'required' in field && field.required}
                  />
                  <p id={`${field.name}-helper`} className="mt-2 text-xs leading-5 text-ink/55">
                    {field.helper}
                  </p>
                  <FieldError errors={formErrors[field.name]} />
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-3xl border border-trust/10 bg-white/70 p-5">
          <label className="block text-sm font-medium text-ink">
            Notes for the steward <span className="text-ink/45">(optional)</span>
            <textarea
              aria-describedby="notes-helper"
              className="mt-2 min-h-32 w-full rounded-2xl border border-trust/15 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10"
              name="notes"
              placeholder="Add goals, constraints, and any sensitive context the steward should know."
            />
          </label>
          <p id="notes-helper" className="mt-2 text-xs leading-5 text-ink/55">
            Keep this focused on routing context. The request only stores the supported fields shown
            on this page.
          </p>
        </section>

        <div className="flex flex-col gap-3 rounded-3xl bg-sage/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/70">
            Required fields are marked with an asterisk. You can refine optional details with your
            steward later.
          </p>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
