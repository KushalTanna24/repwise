import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { isEligible, type Slot } from '@/domain/training';
import type { AppData } from '@/domain/types';
import { Segmented } from '@/components/ui/segmented';

interface Props {
  data: AppData;
  slot: Slot;
  first: boolean;
  last: boolean;
  onRole: (role: Slot['role']) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddAlternate: () => void;
  onRemoveAlternate: (id: string) => void;
}

const btn = 'press grid size-9 place-items-center text-label-2 disabled:opacity-30';

/** One exercise on a day: name, Main/Extra, reorder, remove, and the alternates line for Extras. */
export function SlotRow({ data, slot, first, last, onRole, onMove, onRemove, onAddAlternate, onRemoveAlternate }: Props) {
  const ex = getExercise(slot.candidates[0] ?? '', data.customExercises);
  const blocked = ex ? !isEligible(ex, data) : false;
  const alternates = slot.candidates.slice(1);
  return (
    <div className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep py-2 pl-4 pr-1">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-body">{ex?.name ?? 'Unknown exercise'}</div>
          {blocked && <div className="text-footnote text-orange">Not available with your equipment</div>}
        </div>
        <Segmented
          className="w-28 shrink-0"
          value={slot.role}
          options={[{ value: 'anchor', label: 'Main' }, { value: 'accessory', label: 'Extra' }]}
          onChange={onRole}
        />
        <button aria-label="Move up" disabled={first} onClick={() => onMove(-1)} className={btn}><ArrowUp className="size-4" /></button>
        <button aria-label="Move down" disabled={last} onClick={() => onMove(1)} className={btn}><ArrowDown className="size-4" /></button>
        <button aria-label="Remove exercise" onClick={onRemove} className={btn}><X className="size-4" /></button>
      </div>
      {slot.role === 'accessory' && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pr-3">
          <span className="text-footnote text-label-2">Alternates:</span>
          {alternates.map((id) => (
            <span key={id} className="flex items-center gap-1 rounded-full bg-fill py-1 pl-2.5 pr-1.5 text-caption font-semibold text-label-2">
              {getExercise(id, data.customExercises)?.name ?? id}
              <button aria-label="Remove alternate" onClick={() => onRemoveAlternate(id)} className="press grid size-5 place-items-center"><X className="size-3" /></button>
            </span>
          ))}
          <button aria-label="Add alternate" onClick={onAddAlternate} className="press grid size-7 place-items-center rounded-full bg-blue/12 text-blue">
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
