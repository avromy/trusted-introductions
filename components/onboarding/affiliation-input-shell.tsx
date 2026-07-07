import * as React from 'react';

import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

export type AffiliationInputShellProps = {
  id: string;
  label?: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function AffiliationInputShell({
  id,
  label = 'Affiliation',
  description = 'Share an organization, school, synagogue, professional group, or other trusted connection.',
  value,
  onChange,
  placeholder = 'Add an affiliation',
  className,
}: AffiliationInputShellProps) {
  const descriptionId = `${id}-description`;

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      {description ? (
        <p className="text-sm text-ink/70" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <Input
        aria-describedby={description ? descriptionId : undefined}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}
