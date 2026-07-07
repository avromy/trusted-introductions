import * as React from 'react';

import { cn } from '@/lib/utils';

import type { OnboardingChoice } from './types';

export type RoleSelectorProps = {
  options: OnboardingChoice[];
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
  legend?: string;
  description?: string;
  multiSelect?: boolean;
  className?: string;
};

export function RoleSelector({
  options,
  selectedValues,
  onChange,
  legend = 'How would you like to participate?',
  description,
  multiSelect = true,
  className,
}: RoleSelectorProps) {
  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);

  function toggleValue(value: string) {
    if (multiSelect) {
      onChange(selectedSet.has(value) ? selectedValues.filter((selectedValue) => selectedValue !== value) : [...selectedValues, value]);
      return;
    }

    onChange(selectedSet.has(value) ? [] : [value]);
  }

  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="text-base font-semibold text-ink">{legend}</legend>
      {description ? <p className="-mt-2 text-sm text-ink/70">{description}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2" role={multiSelect ? 'group' : 'radiogroup'} aria-label={legend}>
        {options.map((option) => {
          const selected = selectedSet.has(option.value);
          return (
            <button
              aria-pressed={multiSelect ? selected : undefined}
              aria-checked={multiSelect ? undefined : selected}
              className={cn(
                'rounded-3xl border bg-white p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:cursor-not-allowed disabled:opacity-50',
                selected ? 'border-trust shadow-soft ring-4 ring-trust/10' : 'border-trust/15 hover:border-trust/40',
              )}
              disabled={option.disabled}
              key={option.value}
              onClick={() => toggleValue(option.value)}
              role={multiSelect ? undefined : 'radio'}
              type="button"
            >
              <span className="block text-sm font-semibold text-ink">{option.label}</span>
              {option.description ? <span className="mt-1 block text-sm text-ink/65">{option.description}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
