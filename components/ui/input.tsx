import * as React from 'react';

import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-2xl border border-trust/15 bg-white px-4 text-sm outline-none transition placeholder:text-ink/40 focus:border-trust focus:ring-4 focus:ring-trust/10',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
