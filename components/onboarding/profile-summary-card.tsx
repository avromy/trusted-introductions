import * as React from 'react';

import { Badge, Card } from '@/components/ui';
import { cn } from '@/lib/utils';

import type { ProfileSummaryItem } from './types';

export type ProfileSummaryCardProps = {
  name: string;
  subtitle?: string;
  items?: ProfileSummaryItem[];
  roles?: string[];
  privacyLabel?: string;
  footer?: React.ReactNode;
  className?: string;
};

export function ProfileSummaryCard({ name, subtitle, items = [], roles = [], privacyLabel, footer, className }: ProfileSummaryCardProps) {
  return (
    <Card className={cn('space-y-5', className)}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-trust">Profile summary</p>
        <div>
          <h2 className="text-xl font-semibold text-ink">{name}</h2>
          {subtitle ? <p className="mt-1 text-sm text-ink/70">{subtitle}</p> : null}
        </div>
      </div>
      {roles.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Selected roles">
          {roles.map((role) => (
            <Badge key={role}>{role}</Badge>
          ))}
        </div>
      ) : null}
      {items.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div className="rounded-2xl bg-sage/30 p-3" key={item.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">{item.label}</dt>
              <dd className="mt-1 text-sm text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {privacyLabel ? <p className="rounded-2xl bg-trust/5 p-3 text-sm text-trust">Privacy: {privacyLabel}</p> : null}
      {footer ? <div>{footer}</div> : null}
    </Card>
  );
}
