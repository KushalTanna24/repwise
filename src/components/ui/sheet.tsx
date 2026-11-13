import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Navigation-bar style actions either side of the title. */
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  /** Near full-height card sheet for long flows such as the workout. */
  tall?: boolean;
  dismissible?: boolean;
}

export function Sheet({ open, onClose, title, left, right, children, tall, dismissible = true }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} dismissible={dismissible} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[640px] flex-col rounded-t-[14px] bg-bg outline-none',
            tall ? 'h-[96dvh]' : 'max-h-[92dvh]',
          )}
        >
          <div className="mx-auto mt-[6px] h-[5px] w-9 shrink-0 rounded-full bg-label-3" />
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2 pt-1">
            <div className="justify-self-start">{left}</div>
            <Drawer.Title className="truncate text-headline font-semibold">{title}</Drawer.Title>
            <div className="justify-self-end">{right}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))]" data-vaul-no-drag={tall ? '' : undefined}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
