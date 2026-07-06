import { cn } from '@/lib/utils';

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={cn('inline-flex size-10 items-center justify-center rounded-full bg-trust text-sm font-bold text-white', className)}>
      {initials}
    </span>
  );
}
