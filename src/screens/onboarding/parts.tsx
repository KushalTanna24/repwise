import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-1 pb-5 pt-2">
      <h1 className="text-title2 font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-subhead text-label-2">{subtitle}</p>}
    </div>
  );
}

/**
 * The one primary action of a step, pinned above the home indicator. Portalled to the body:
 * the step's slide transform would otherwise make `fixed` relative to the step, not the screen.
 */
export function StepFooter({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="pb-safe fixed inset-x-0 bottom-0 z-50 bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[640px] flex-col gap-2 px-4 pb-4 pt-3">{children}</div>
    </div>,
    document.body,
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="pb-2 text-subhead font-semibold">{children}</div>;
}

export function NextButton({ disabled, onClick, label = 'Next' }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button size="lg" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Grouped rows with a checkmark; single choice unless `multi`. */
export function ChoiceList<T extends string>({ options, selected, onToggle }: { options: Choice<T>[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <List>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className="flex min-h-[52px] w-full items-center gap-3 pl-4 text-left active:bg-fill-2 [&:not(:last-child)>:last-child]:border-b [&:not(:last-child)>:last-child]:border-sep"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
              <div className="min-w-0 flex-1">
                <div className={cn('text-body', on && 'font-semibold')}>{o.label}</div>
                {o.hint && <div className="text-footnote text-label-2">{o.hint}</div>}
              </div>
              <Check className={cn('size-5 shrink-0 text-blue transition-opacity', on ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
            </div>
          </button>
        );
      })}
    </List>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return children ? <p className="px-4 pt-2 text-footnote text-red">{children}</p> : null;
}
