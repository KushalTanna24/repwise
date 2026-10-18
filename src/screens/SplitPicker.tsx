import { Check } from 'lucide-react';
import { SPLITS } from '@/domain/splits';
import { setSplit } from '@/domain/session';
import type { SplitId } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';

/** The three split cards; used inline on an empty Today and inside the sheet. */
export function SplitChooser({ onPicked }: { onPicked?: () => void }) {
  const data = useData();
  const current = data.program.splitId;

  async function pick(id: SplitId) {
    if (id === current) return onPicked?.();
    if (data.activeSession) return toast('Finish or discard your workout first');
    if (current) {
      const rot = data.program.rotation[id];
      const where = rot.cycle > 1 || rot.sessionIndex > 0 ? `picks up at ${SPLITS[id].sessions[rot.sessionIndex].title}` : 'starts at session 1';
      const ok = await confirm({
        title: `Switch to ${SPLITS[id].name}?`,
        message: `${SPLITS[id].name} ${where}. Your history stays, and ${SPLITS[current].name} keeps its place if you switch back.`,
        confirmLabel: 'Switch',
      });
      if (!ok) return;
    }
    act((d) => setSplit(d, id));
    toast(`${SPLITS[id].name} it is`);
    onPicked?.();
  }

  return (
    <div className="grid gap-3">
      {Object.values(SPLITS).map((s) => (
        <button
          key={s.id}
          onClick={() => pick(s.id)}
          className={cn('press rounded-card bg-card p-4 text-left shadow-card ring-2', s.id === current ? 'ring-blue' : 'ring-transparent')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-headline font-semibold">{s.name}</div>
              <div className="text-footnote text-label-2">{s.blurb}</div>
            </div>
            {s.id === current && <Check className="size-5 text-blue" strokeWidth={3} />}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.sessions.map((x) => (
              <span key={x.title} className="rounded-full bg-fill px-2.5 py-1 text-caption font-semibold text-label-2">
                {x.title}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

export function SplitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Training split" right={<Button variant="plain" size="sm" onClick={onClose}>Done</Button>}>
      <p className="mb-4 px-1 text-subhead text-label-2">
        Your split stays put until you change it here. Each split remembers where you are in its rotation.
      </p>
      <SplitChooser onPicked={onClose} />
    </Sheet>
  );
}
