import * as DM from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** iOS context-menu look on top of Radix dropdown semantics. */
export function Menu({ trigger, items, label }: { trigger: ReactNode; items: MenuItem[]; label: string }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild aria-label={label}>
        {trigger}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          align="end"
          sideOffset={6}
          className="z-[70] min-w-[240px] overflow-hidden rounded-[13px] bg-card/90 shadow-[0_10px_40px_rgb(0_0_0/0.18)] backdrop-blur-xl"
        >
          {items.map((it, i) => (
            <DM.Item
              key={it.label}
              disabled={it.disabled}
              onSelect={it.onSelect}
              className={cn(
                'flex h-11 cursor-pointer items-center justify-between gap-6 px-4 text-body outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-fill',
                i > 0 && 'border-t border-sep',
                it.destructive && 'text-red',
              )}
            >
              {it.label}
              {it.icon}
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
