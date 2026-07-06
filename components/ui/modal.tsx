'use client';

import { type ReactNode, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Modal({ trigger, title, children, className }: { trigger: ReactNode; title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="contents">{trigger}</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className={cn('relative w-[min(92vw,32rem)] rounded-3xl bg-white p-6 shadow-soft', className)}>
            <h2 id={titleId} className="text-xl font-semibold text-ink">{title}</h2>
            <div className="mt-4">{children}</div>
            <Button variant="ghost" className="absolute right-3 top-3 px-3 py-2" onClick={() => setOpen(false)} aria-label="Close modal">×</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
