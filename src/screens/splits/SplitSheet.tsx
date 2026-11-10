import { Check, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { currentRotation, deleteCustomSplit, getSplit, listSplits, newCustomSplit, setSplit, type CustomSplit, type SplitId } from '@/domain/training';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';
import { useSplitDraft } from '@/store/splitDraft';

/** The split cards; used inline on an empty Today and inside the sheet. */
export function SplitChooser({ onPicked }: { onPicked?: () => void }) {
  const data = useData();
  const current = data.program.splitId;

  async function pick(id: SplitId) {
    if (id === current) return onPicked?.();
    if (data.activeSession) return toast('Finish or discard your workout first');
    if (current) {
      const target = getSplit(data, id);
      if (!target) return;
      const rot = currentRotation(data, id);
      const day = target.sessions[rot.sessionIndex];
      const where = day && (rot.cycle > 1 || rot.sessionIndex > 0) ? `picks up at ${day.title}` : 'starts at session 1';
      const ok = await confirm({
        title: `Switch to ${target.name}?`,
        message: `${target.name} ${where}. Your history stays, and ${getSplit(data, current)?.name ?? 'your current split'} keeps its place if you switch back.`,
        confirmLabel: 'Switch',
      });
      if (!ok) return;
    }
    act((d) => setSplit(d, id));
    toast(`${getSplit(data, id)?.name ?? 'Split'} it is`);
    onPicked?.();
  }

  const { builtIn, custom } = listSplits(data);
  const now = () => new Date().toISOString();

  function edit(split: CustomSplit) {
    useSplitDraft.getState().open(split);
    openSheet('split-edit:' + split.id);
  }

  function duplicate(id: SplitId) {
    const { split } = newCustomSplit(data, id, now());
    edit(split);
  }

  async function remove(s: CustomSplit) {
    if (data.activeSession) return toast('Finish or discard your workout first');
    const ok = await confirm({ title: `Delete ${s.name}?`, message: 'Your workout history stays.', confirmLabel: 'Delete' });
    if (!ok) return;
    act((d) => deleteCustomSplit(d, s.id, now()));
    toast(`${s.name} deleted`);
  }

  const card = (s: CustomSplit | (typeof builtIn)[number]) => (
    <button
      onClick={() => pick(s.id)}
      className={cn('press w-full rounded-card bg-card p-4 text-left shadow-card ring-2', s.id === current ? 'ring-blue' : 'ring-transparent', s.custom && 'pr-14')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-headline font-semibold">{s.name}</div>
          <div className="text-footnote text-label-2">{s.blurb}</div>
        </div>
        {s.id === current && <Check className="size-5 shrink-0 text-blue" strokeWidth={3} />}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.sessions.map((x, i) => (
          <span key={i} className="rounded-full bg-fill px-2.5 py-1 text-caption font-semibold text-label-2">
            {x.title}
          </span>
        ))}
      </div>
    </button>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {builtIn.map((s) => (
        <div key={s.id}>{card(s)}</div>
      ))}
      {custom.length > 0 && <h3 className="mt-2 px-1 text-footnote font-semibold uppercase text-label-2">Your splits</h3>}
      {custom.map((s) => (
        <div key={s.id} className="relative">
          {card(s)}
          <div className="absolute bottom-2 right-2">
            <Menu
              label={`${s.name} options`}
              trigger={
                <button className="press grid size-10 place-items-center rounded-full text-label-2">
                  <MoreHorizontal className="size-5" />
                </button>
              }
              items={[
                { label: 'Edit', icon: <Pencil />, onSelect: () => edit(s) },
                { label: 'Duplicate', icon: <Copy />, onSelect: () => duplicate(s.id) },
                { label: 'Delete', icon: <Trash2 />, destructive: true, onSelect: () => remove(s) },
              ]}
            />
          </div>
        </div>
      ))}
      <Button variant="tinted" onClick={() => openSheet('split-new')}>
        <Plus className="size-5" /> Build your own
      </Button>
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
