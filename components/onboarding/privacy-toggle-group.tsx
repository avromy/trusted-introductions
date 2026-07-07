import * as React from 'react';

import { cn } from '@/lib/utils';

import type { OnboardingChoice } from './types';

export type PrivacyToggleGroupProps = {
  options: OnboardingChoice[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  className?: string;
};

export function PrivacyToggleGroup({ options, value, onChange, label = 'Privacy preference', description, className }: PrivacyToggleGroupProps) {
  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="text-base font-semibold text-ink">{label}</legend>
      {description ? <p className="-mt-2 text-sm text-ink/70">{description}</p> : null}
      <div className="grid gap-2 rounded-3xl bg-sage/40 p-2 sm:grid-cols-3" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              aria-checked={selected}
              className={cn(
                'rounded-2xl px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:cursor-not-allowed disabled:opacity-50',
                selected ? 'bg-white font-semibold text-trust shadow-soft' : 'text-ink/70 hover:bg-white/70',
              )}
              disabled={option.disabled}
              key={option.value}
              onClick={() => onChange(option.value)}
              role="radio"
              type="button"
            >
              <span className="block">{option.label}</span>
              {option.description ? <span className="mt-1 block text-xs font-normal text-ink/60">{option.description}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
