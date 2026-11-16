import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { create } from 'zustand';
import { cn } from '@/lib/cn';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
interface State extends ConfirmOptions {
  open: boolean;
  resolve?: (ok: boolean) => void;
}

const useConfirm = create<State>(() => ({ open: false, title: '' }));

/** iOS-style alert. Resolves true on confirm, false on cancel. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) =>
    useConfirm.setState({ confirmLabel: undefined, cancelLabel: undefined, destructive: false, message: undefined, ...opts, open: true, resolve }),
  );
}

export function ConfirmHost() {
  const s = useConfirm();
  const done = (ok: boolean) => {
    s.resolve?.(ok);
    useConfirm.setState({ open: false, resolve: undefined });
  };
  return (
    <AlertDialog.Root open={s.open} onOpenChange={(o) => !o && done(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[280px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] bg-card/95 text-center shadow-2xl backdrop-blur-xl">
          <div className="px-4 pb-4 pt-5">
            <AlertDialog.Title className="text-headline font-semibold">{s.title}</AlertDialog.Title>
            <AlertDialog.Description className={cn('mt-1 text-footnote', !s.message && 'sr-only')}>{s.message ?? s.title}</AlertDialog.Description>
          </div>
          <div className="grid grid-cols-2 border-t border-sep text-body">
            <AlertDialog.Cancel className="h-11 border-r border-sep text-blue active:bg-fill-2">{s.cancelLabel ?? 'Cancel'}</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={() => done(true)}
              className={cn('h-11 font-semibold active:bg-fill-2', s.destructive ? 'text-red' : 'text-blue')}
            >
              {s.confirmLabel ?? 'OK'}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
