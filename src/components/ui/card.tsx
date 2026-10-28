import type { HTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-card rounded-card shadow-card', className)} {...props} />;
}

/** Grouped-list section heading, iOS style. */
export function SectionHeader({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-end justify-between px-1 pb-2 pt-7', className)}>
      <h2 className="text-title3 font-bold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('bg-card rounded-card shadow-card overflow-hidden', className)}>{children}</div>;
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  leading?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  className?: string;
}

/** List row; rows inside a List get an inset hairline between them. */
export function Row({ title, subtitle, value, leading, onClick, chevron, destructive, className }: RowProps) {
  const body = (
    <>
      {leading}
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-body', destructive && 'text-red')}>{title}</div>
          {subtitle && <div className="truncate text-footnote text-label-2">{subtitle}</div>}
        </div>
        {value != null && <div className="shrink-0 text-body text-label-2 tabular">{value}</div>}
        {chevron && <ChevronRight className="size-4 shrink-0 text-label-3" strokeWidth={2.5} />}
      </div>
    </>
  );
  const cls = cn('flex w-full min-h-[48px] [&:not(:last-child)>:last-child]:border-b [&:not(:last-child)>:last-child]:border-sep items-center gap-3 pl-4 text-left', className);
  return onClick ? (
    <button onClick={onClick} className={cn(cls, 'active:bg-fill-2')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-label-3">{icon}</div>}
      <div className="text-headline font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-[32ch] text-subhead text-label-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
