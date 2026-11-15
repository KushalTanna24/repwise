import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { isEligible, prescription, type Slot } from '@/domain/training';
import type { AppData } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/cn';

interface Props {
  data: AppData;
  slot: Slot;
  index: number;
  first: boolean;
  last: boolean;
  open: boolean;
  onToggle: () => void;
  onRole: (role: Slot['role']) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddAlternate: () => void;
  onRemoveAlternate: (id: string) => void;
}

/** One exercise on a day. Collapsed it reads like a line of the workout; tap it to change it. */
export function SlotRow({ data, slot, index, first, last, open, onToggle, onRole, onMove, onRemove, onAddAlternate, onRemoveAlternate }: Props) {
  const ex = getExercise(slot.candidates[0] ?? '', data.customExercises);
  const blocked = ex ? !isEligible(ex, data) : false;
  const alternates = slot.candidates.slice(1);
  const rx = prescription(data.profile, slot.role, ex, data.profile.sessionMinutes);
  const amount = ex?.pattern === 'cardio' ? `${Math.round(rx.repMin / 60)} min` : ex?.kind === 'timed' ? `${rx.sets} × ${rx.repMin}–${rx.repMax}s` : `${rx.sets} × ${rx.repMin}–${rx.repMax}`;
  const meta = [slot.role === 'anchor' ? 'Main lift' : 'Extra', amount, alternates.length ? `${alternates.length} swap${alternates.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');

  return (
    <div className="pl-4 [&:not(:last-child)>div]:border-b [&:not(:last-child)>div]:border-sep">
      <div className="pr-4">
        <button onClick={onToggle} aria-expanded={open} className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fill text-footnote font-semibold text-label-2">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-body">{ex?.name ?? 'Unknown exercise'}</span>
            <span className="block text-footnote text-label-2">{meta}</span>
            {blocked && <span className="block text-footnote text-orange">Not available with your equipment</span>}
          </span>
          <ChevronDown className={cn('size-5 shrink-0 text-label-3 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="grid gap-4 pb-4 pl-10">
            <Segmented
              value={slot.role}
              options={[
                { value: 'anchor', label: 'Main lift' },
                { value: 'accessory', label: 'Extra' },
              ]}
              onChange={onRole}
            />
            {slot.role === 'anchor' ? (
              <p className="text-footnote text-label-2">Main lifts stay the same every cycle, so your progress on them is easy to compare.</p>
            ) : (
              <div>
                <div className="text-footnote font-semibold text-label-2">Swaps for this exercise</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {alternates.map((id) => (
                    <span key={id} className="flex items-center gap-1 rounded-full bg-fill py-1.5 pl-3 pr-1.5 text-subhead">
                      {getExercise(id, data.customExercises)?.name ?? id}
                      <button aria-label="Remove swap" onClick={() => onRemoveAlternate(id)} className="press grid size-6 place-items-center rounded-full text-label-2">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  {alternates.length < 2 && (
                    <Button variant="tinted" size="sm" onClick={onAddAlternate}>
                      <Plus className="mr-1 size-4" /> Add swap
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="gray" size="sm" disabled={first} onClick={() => onMove(-1)}>
                <ArrowUp className="mr-1 size-4" /> Move up
              </Button>
              <Button variant="gray" size="sm" disabled={last} onClick={() => onMove(1)}>
                <ArrowDown className="mr-1 size-4" /> Move down
              </Button>
              <Button variant="destructive" size="sm" onClick={onRemove}>
                <Trash2 className="mr-1 size-4" /> Remove
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
