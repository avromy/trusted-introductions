'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button, Card } from '@/components/ui';
import type { PrivacySettings } from '@/types/privacy';
import { saveOnboardingPrivacyAction, type OnboardingPrivacyFormState } from './actions';

const visibilityOptions = [
  { value: 'private', label: 'Private' },
  { value: 'members', label: 'Members' },
] as const;

const initialState: OnboardingPrivacyFormState = { ok: false, message: null };

function SaveButton() {
  const { pending } = useFormStatus();

  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save privacy settings'}</Button>;
}

type SelectFieldProps = {
  label: string;
  name: keyof Pick<PrivacySettings, 'profileVisibility' | 'resumeVisibility' | 'contactVisibility'>;
  defaultValue: string;
  helper: string;
};

function SelectField({ label, name, defaultValue, helper }: SelectFieldProps) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <select
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
        defaultValue={defaultValue}
        name={name}
      >
        {visibilityOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <span className="block text-xs font-normal leading-5 text-ink/60">{helper}</span>
    </label>
  );
}

type CheckboxFieldProps = {
  label: string;
  name: keyof Pick<PrivacySettings, 'publicMeetPageEnabled' | 'helperActivityVisible' | 'allowAiSummary'>;
  defaultChecked: boolean;
};

function CheckboxField({ label, name, defaultChecked }: CheckboxFieldProps) {
  return (
    <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-medium text-ink ring-1 ring-black/5">
      <input className="mt-1 h-4 w-4 rounded border-black/20 text-trust focus:ring-trust" defaultChecked={defaultChecked} name={name} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

export function PrivacySettingsForm({ settings }: { settings: PrivacySettings }) {
  const [state, formAction] = useActionState(saveOnboardingPrivacyAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Card className="bg-cream p-5 shadow-none">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Profile" name="profileVisibility" defaultValue={settings.profileVisibility} helper="Who can see basic profile details." />
          <SelectField label="Resume" name="resumeVisibility" defaultValue={settings.resumeVisibility} helper="Who can see resume information." />
          <SelectField label="Contact" name="contactVisibility" defaultValue={settings.contactVisibility} helper="Who can see direct contact details." />
        </div>
      </Card>

      <div className="grid gap-3">
        <CheckboxField label="Enable a public meet page" name="publicMeetPageEnabled" defaultChecked={settings.publicMeetPageEnabled} />
        <CheckboxField label="Show helper activity to members" name="helperActivityVisible" defaultChecked={settings.helperActivityVisible} />
        <CheckboxField label="Allow an AI-generated summary" name="allowAiSummary" defaultChecked={settings.allowAiSummary} />
      </div>

      {state.message ? (
        <p className={state.ok ? 'text-sm font-semibold text-trust' : 'text-sm font-semibold text-rust'} aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <SaveButton />
    </form>
  );
}
