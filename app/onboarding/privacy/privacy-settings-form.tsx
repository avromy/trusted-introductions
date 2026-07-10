'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { Button, Card } from '@/components/ui';
import type { PrivacySettings } from '@/types/privacy';
import { saveOnboardingPrivacyAction, type OnboardingPrivacyFormState } from './actions';

const profileVisibilityOptions = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only you and authorized stewards can use profile details for onboarding support.',
  },
  {
    value: 'members',
    label: 'Members',
    description:
      'Signed-in community members can see your name, role, affiliations, and profile basics.',
  },
] as const;

const sensitiveVisibilityOptions = [
  {
    value: 'private',
    label: 'Private',
    description: 'Keep this hidden unless you choose to share it during a specific introduction.',
  },
  {
    value: 'helpers',
    label: 'Helpers only',
    description:
      'Trusted helpers and stewards can review it while coordinating introduction support.',
  },
  {
    value: 'members',
    label: 'Members',
    description: 'Signed-in community members can see it on eligible member-only experiences.',
  },
] as const;

const initialState: OnboardingPrivacyFormState = { ok: false, message: null };

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save privacy settings'}
    </Button>
  );
}

type SelectFieldProps = {
  label: string;
  name: keyof Pick<PrivacySettings, 'profileVisibility' | 'resumeVisibility' | 'contactVisibility'>;
  defaultValue: string;
  helper: string;
  warning?: string;
  options: ReadonlyArray<{ value: string; label: string; description: string }>;
};

function SelectField({ label, name, defaultValue, helper, warning, options }: SelectFieldProps) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <select
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} — {option.description}
          </option>
        ))}
      </select>
      <span className="block text-xs font-normal leading-5 text-ink/60">{helper}</span>
      {warning ? (
        <span className="block text-xs font-semibold leading-5 text-rust">{warning}</span>
      ) : null}
    </label>
  );
}

type CheckboxFieldProps = {
  label: string;
  name: keyof Pick<
    PrivacySettings,
    'publicMeetPageEnabled' | 'helperActivityVisible' | 'allowAiSummary'
  >;
  defaultChecked: boolean;
  description: string;
  warning?: string;
};

function CheckboxField({ label, name, defaultChecked, description, warning }: CheckboxFieldProps) {
  return (
    <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-medium text-ink ring-1 ring-black/5">
      <input
        className="mt-1 h-4 w-4 rounded border-black/20 text-trust focus:ring-trust"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      <span className="space-y-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs font-normal leading-5 text-ink/60">{description}</span>
        {warning ? (
          <span className="block text-xs font-semibold leading-5 text-rust">{warning}</span>
        ) : null}
      </span>
    </label>
  );
}

export function PrivacySettingsForm({ settings }: { settings: PrivacySettings }) {
  const [state, formAction] = useFormState(saveOnboardingPrivacyAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Card className="space-y-4 bg-cream p-5 shadow-none">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">
            Choose the smallest audience that works
          </h2>
          <p className="text-sm leading-6 text-ink/70">
            Defaults are private. Raising visibility can help members make better introductions, but
            resume and contact details may include sensitive personal data.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SelectField
            label="Public profile visibility"
            name="profileVisibility"
            defaultValue={settings.profileVisibility}
            helper="Controls whether your basic profile appears to the community. Public web access also requires the public meet page setting below."
            warning="Member visibility exposes profile basics beyond stewards."
            options={profileVisibilityOptions}
          />
          <SelectField
            label="Resume visibility"
            name="resumeVisibility"
            defaultValue={settings.resumeVisibility}
            helper="Controls who can see resume history, skills, education, and role preferences."
            warning="Resumes can reveal employers, dates, locations, and career plans. Share only with audiences you trust."
            options={sensitiveVisibilityOptions}
          />
          <SelectField
            label="Contact visibility"
            name="contactVisibility"
            defaultValue={settings.contactVisibility}
            helper="Controls who can see direct email, phone, or social contact details."
            warning="Direct contact details can be copied or used outside Trusted Introductions."
            options={sensitiveVisibilityOptions}
          />
        </div>
      </Card>

      <div className="grid gap-3">
        <CheckboxField
          label="Enable a public meet page"
          name="publicMeetPageEnabled"
          defaultChecked={settings.publicMeetPageEnabled}
          description="Creates a shareable public page only after you enable it; keep it off to prevent public discovery."
          warning="Public pages may be viewed outside the community. Do not enable this if your profile should stay private."
        />
        <CheckboxField
          label="Show helper activity to members"
          name="helperActivityVisible"
          defaultChecked={settings.helperActivityVisible}
          description="Lets members see helper-facing introduction activity, such as availability or support signals."
          warning="Activity can reveal that you are seeking help or involved in specific introduction workflows."
        />
        <CheckboxField
          label="Allow an AI-generated summary"
          name="allowAiSummary"
          defaultChecked={settings.allowAiSummary}
          description="Permits Trusted Introductions to generate a concise profile summary from the information you provide."
          warning="AI summaries may condense sensitive resume or profile context; review generated text before relying on it."
        />
      </div>

      {state.message ? (
        <p
          className={
            state.ok ? 'text-sm font-semibold text-trust' : 'text-sm font-semibold text-rust'
          }
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <SaveButton />
    </form>
  );
}
