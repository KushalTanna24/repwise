import * as DM from '@radix-ui/react-dropdown-menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** iOS context-menu surface: frosted, 14px radius, scales in from the trigger. */
const SURFACE =
  'z-[70] min-w-[250px] max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto overscroll-contain rounded-[14px] bg-[rgb(249_249_249/0.82)] p-0 shadow-[0_0_0_0.5px_rgb(0_0_0/0.06),0_12px_40px_rgb(0_0_0/0.22)] backdrop-blur-2xl backdrop-saturate-150 origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-[menu-in_200ms_cubic-bezier(0.22,1,0.36,1)]';
const ITEM =
  'flex min-h-11 cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-[17px] leading-[22px] tracking-[-0.02em] outline-none data-[disabled]:opacity-35 data-[highlighted]:bg-black/[0.06] [&:not(:first-child)]:border-t-[0.5px] [&:not(:first-child)]:border-black/[0.12]';

export function Menu({ trigger, items, label }: { trigger: ReactNode; items: MenuItem[]; label: string }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild aria-label={label}>
        {trigger}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} collisionPadding={12} className={SURFACE}>
          {items.map((it) => (
            <DM.Item key={it.label} disabled={it.disabled} onSelect={it.onSelect} className={cn(ITEM, 'justify-between', it.destructive && 'text-red')}>
              {it.label}
              <span className="shrink-0 [&_svg]:size-[18px]">{it.icon}</span>
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

interface PickerProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
  className?: string;
}

/** iOS pop-up button: current value + chevrons, opens a menu with a checkmark on the selected option. */
export function Picker<T extends string | number>({ value, options, onChange, label, className }: PickerProps<T>) {
  const current = options.find((o) => o.value === value);
  return (
    <DM.Root modal={false}>
      <DM.Trigger
        aria-label={label}
        className={cn('press inline-flex min-w-0 max-w-[60vw] items-center gap-1 text-body text-label-2 outline-none', className)}
      >
        <span className="truncate">{current?.label ?? '—'}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-label-3" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} collisionPadding={12} className={SURFACE}>
          <DM.RadioGroup value={String(value)} onValueChange={(v) => onChange(options.find((o) => String(o.value) === v)!.value)}>
            {options.map((o) => (
              <DM.RadioItem key={String(o.value)} value={String(o.value)} className={cn(ITEM, 'pl-3')}>
                <span className="grid w-5 shrink-0 place-items-center">
                  <DM.ItemIndicator>
                    <Check className="size-[17px]" strokeWidth={2.75} />
                  </DM.ItemIndicator>
                </span>
                <span className="truncate">{o.label}</span>
              </DM.RadioItem>
            ))}
          </DM.RadioGroup>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
