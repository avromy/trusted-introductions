import * as React from 'react';

import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export type CommunitySelectorShellProps = {
  title?: string;
  description?: string;
  selectedCount?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function CommunitySelectorShell({
  title = 'Community context',
  description = 'Choose the communities or trusted circles that should shape your onboarding.',
  selectedCount,
  action,
  children,
  className,
}: CommunitySelectorShellProps) {
  return (
    <Card className={cn('space-y-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink/70">{description}</p>
          {typeof selectedCount === 'number' ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-trust">{selectedCount} selected</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div>{children}</div>
    </Card>
  );
}
