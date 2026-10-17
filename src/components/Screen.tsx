import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ScreenProps {
  title: string;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/** Large title that collapses into a blurred inline bar on scroll. */
export function Screen({ title, eyebrow, action, children }: ScreenProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-44px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto min-h-dvh max-w-[640px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div
        className={cn(
          'pt-safe fixed inset-x-0 top-0 z-30 transition-colors duration-200',
          compact ? 'border-b border-sep bg-bg/80 backdrop-blur-xl' : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-11 max-w-[640px] items-center justify-between px-4">
          <div className="w-16" />
          <div className={cn('text-headline font-semibold transition-opacity duration-200', compact ? 'opacity-100' : 'opacity-0')}>{title}</div>
          <div className="flex w-16 justify-end">{action}</div>
        </div>
      </div>
      <div className="pt-safe">
        <div className="h-11" />
        {eyebrow && <div className="px-1 text-footnote font-semibold uppercase tracking-wide text-label-2">{eyebrow}</div>}
        <h1 className="px-1 text-largetitle font-bold">{title}</h1>
        <div ref={sentinel} className="h-px" />
      </div>
      {children}
    </div>
  );
}
