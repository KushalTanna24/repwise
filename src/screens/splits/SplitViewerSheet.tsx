import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { describeSplit } from '@/domain/splitView';
import { getSplit, type SplitId } from '@/domain/training';
import { Button } from '@/components/ui/button';
import { List, Row } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useData } from '@/store/app';

interface Props {
  splitId: SplitId | null;
  onClose: () => void;
  onUse: (id: SplitId) => void;
  onEdit?: (id: SplitId) => void;
}

/** Look inside a split before using it: each day, the muscles it trains and the exercises it asks for. */
export function SplitViewerSheet({ splitId, onClose, onUse, onEdit }: Props) {
  const data = useData();
  const [day, setDay] = useState(0);
  useEffect(() => setDay(0), [splitId]);
  const split = splitId ? getSplit(data, splitId) : undefined;
  const days = split ? describeSplit(data, split) : [];
  const current = splitId === data.program.splitId;
  const d = days[Math.min(day, days.length - 1)];

  return (
    <Sheet open={!!split} onClose={onClose} tall title={split?.name ?? ''} right={<Button variant="plain" size="sm" onClick={onClose}>Close</Button>}>
      {split && d && (
        <div className="pb-28">
          <p className="px-1 text-subhead text-label-2">
            {days.length} {days.length === 1 ? 'day' : 'days'} in the rotation. Tap a day to see what it asks for.
          </p>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Days">
            {days.map((x, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === day}
                onClick={() => setDay(i)}
                className={cn('shrink-0 rounded-full px-3.5 py-2 text-subhead font-semibold', i === day ? 'bg-blue text-white' : 'bg-fill text-label')}
              >
                {i + 1} · {x.title}
              </button>
            ))}
          </div>
          <div className="mt-4 px-1">
            <div className="text-title3 font-bold">{d.title}</div>
            <p className="mt-0.5 text-subhead text-label-2">{d.muscles}</p>
          </div>
          <List className="mt-3">
            {d.exercises.map((e, i) => (
              <Row
                key={i}
                title={e.name}
                subtitle={[e.main ? 'Main lift' : null, e.alternates > 0 ? `${e.alternates} swap${e.alternates === 1 ? '' : 's'} available` : null].filter(Boolean).join(' · ') || undefined}
                value={e.rx}
              />
            ))}
          </List>
          <p className="mt-2 px-1 text-footnote text-label-3">Sets × reps. Loads come from your history once you start.</p>
        </div>
      )}
      {split && (
        <div className="pb-safe fixed inset-x-0 bottom-0 bg-bg/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[640px] flex-col gap-2 px-4 pb-4 pt-3">
            <Button size="lg" disabled={current} onClick={() => onUse(split.id)}>
              {current ? 'Your current split' : 'Use this split'}
            </Button>
            {split.custom && onEdit && (
              <Button variant="plain" onClick={() => onEdit(split.id)}>
                <Pencil className="mr-1 size-4" /> Edit days and exercises
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
