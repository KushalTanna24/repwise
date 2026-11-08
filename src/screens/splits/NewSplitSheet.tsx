import { ChevronRight, Plus } from 'lucide-react';
import { listSplits, newCustomSplit, type SplitId } from '@/domain/training';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { openSheet } from '@/lib/route';
import { useData } from '@/store/app';
import { useSplitDraft } from '@/store/splitDraft';

/** Pick what the new split starts from. Nothing is stored until the editor saves. */
export function NewSplitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const { builtIn, custom } = listSplits(data);

  function start(from: SplitId | null) {
    const { split } = newCustomSplit(data, from, new Date().toISOString());
    useSplitDraft.getState().open(split);
    openSheet('split-edit:' + split.id, { replace: true });
  }

  const row = (key: string, name: string, sub: string, from: SplitId | null) => (
    <button key={key} onClick={() => start(from)} className="press flex min-h-14 w-full items-center justify-between gap-3 rounded-card bg-card px-4 py-3 text-left shadow-card">
      <div className="min-w-0">
        <div className="truncate text-body font-semibold">{name}</div>
        <div className="truncate text-footnote text-label-2">{sub}</div>
      </div>
      {from ? <ChevronRight className="size-5 shrink-0 text-label-3" /> : <Plus className="size-5 shrink-0 text-blue" />}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Start from" right={<Button variant="plain" size="sm" onClick={onClose}>Cancel</Button>}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {row('blank', 'Blank', 'One empty day to build on', null)}
        {builtIn.map((s) => row(s.id, s.name, s.blurb, s.id))}
        {custom.map((s) => row(s.id, s.name, s.blurb, s.id))}
      </div>
    </Sheet>
  );
}
