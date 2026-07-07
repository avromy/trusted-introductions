import * as React from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl bg-white/85 p-6 shadow-soft ring-1 ring-black/5', className)} {...props} />;
}
