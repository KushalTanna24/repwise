import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { allExercises, getExercise } from '@/domain/catalogue';
import {
  FOCUS_LABEL, addAlternate, addEntry, dayGuide, fillDay, isEligible, moveEntry, removeAlternate, removeEntry, renameDay, setRole, suggestDay,
  type CustomSplit, type DayFocus,
} from '@/domain/training';
import type { Exercise } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List, Row } from '@/components/ui/card';
import { closeSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { useData } from '@/store/app';
import { useSplitDraft } from '@/store/splitDraft';
import { ExercisePicker } from '@/screens/workout/ExercisePicker';
import { SlotRow } from './SlotRow';
import { INPUT } from './SplitEditorSheet';

type Mode = { kind: 'add' } | { kind: 'alt'; slot: number } | { kind: 'fill' } | null;

const FOCUSES = Object.keys(FOCUS_LABEL) as DayFocus[];

/** Edits one day of the draft. Shares the draft with the split editor, so there is no discard step here. */
export function DayEditorSheet({ splitId, day, onClose }: { splitId: string | null; day: number; onClose: () => void }) {
  const data = useData();
  const draft = useSplitDraft((s) => s.draft);
  const focus = useSplitDraft((s) => s.focus[day]);
  const [mode, setMode] = useState<Mode>(null);
  const live = splitId !== null && draft?.id === splitId ? draft : null;
  const d = live?.sessions[day];
  const missing = splitId !== null && !d;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (missing) closeSheet({ replace: true });
  }, [missing]);
  useEffect(() => {
    if (!splitId && wasOpen.current) setMode(null);
    wasOpen.current = !!splitId;
  }, [splitId]);

  /** Apply an edit; when the helper refuses (returns the same split) say why. */
  function change(fn: (s: CustomSplit) => CustomSplit, refusal?: string) {
    const cur = useSplitDraft.getState().draft;
    if (!cur) return;
    if (fn(cur) === cur) return refusal ? toast(refusal) : undefined;
    useSplitDraft.getState().edit(fn);
  }

  const slots = d?.slots ?? [];
  const ids = slots.flatMap((s) => s.candidates);

  function suggestions(): Exercise[] {
    const list = focus
      ? suggestDay(data, focus, ids).map((s) => getExercise(s.candidates[0] ?? '', data.customExercises))
      : allExercises(data).filter((e) => slots.some((s) => s.pattern === e.pattern) && isEligible(e, data));
    return list.filter((e): e is Exercise => !!e && !ids.includes(e.id)).slice(0, 8);
  }

  function pick(id: string) {
    const ex = getExercise(id, data.customExercises);
    if (!ex || !mode) return;
    if (mode.kind === 'add') {
      change((s) => addEntry(s, day, ex), ids.includes(id) ? 'Already on this day' : 'A day holds up to 12 exercises');
      setMode(null);
    } else if (mode.kind === 'alt') {
      const at = mode.slot;
      change((s) => addAlternate(s, day, at, id), ids.includes(id) ? 'Already on this day' : 'Up to 2 alternates');
      setMode(null);
    }
  }

  function fill(f: DayFocus) {
    useSplitDraft.getState().setFocus(day, f);
    change((s) => fillDay(s, day, suggestDay(data, f)));
    setMode(null);
  }

  const alt = mode?.kind === 'alt' ? slots[mode.slot] : undefined;
  const picking = mode?.kind === 'add' || (mode?.kind === 'alt' && alt);
  const back = <Button variant="plain" size="sm" onClick={() => setMode(null)}>Back</Button>;
  const guide = dayGuide(data.profile, slots.length);

  return (
    <Sheet
      open={!!d}
      onClose={onClose}
      title={mode ? (mode.kind === 'fill' ? 'Fill this day' : mode.kind === 'alt' ? 'Add alternate' : 'Add exercise') : d?.title || 'Day'}
      left={mode ? back : undefined}
      right={mode ? undefined : <Button variant="plain" size="sm" onClick={onClose}>Done</Button>}
    >
      {d && mode?.kind === 'fill' && (
        <List>
          {FOCUSES.map((f) => (
            <Row key={f} title={FOCUS_LABEL[f]} chevron onClick={() => fill(f)} />
          ))}
        </List>
      )}
      {d && picking && (
        <ExercisePicker
          data={data}
          suggested={mode?.kind === 'add' ? suggestions() : []}
          exclude={ids}
          suggestedLabel={mode?.kind === 'add' ? 'Suggested for this day' : undefined}
          pattern={alt?.pattern}
          onPick={pick}
        />
      )}
      {d && !mode && (
        <div className="grid gap-5">
          <label className="flex items-center gap-3">
            <span className="w-14 text-subhead text-label-2">Day name</span>
            <input value={d.title} maxLength={30} onChange={(e) => change((s) => renameDay(s, day, e.target.value))} className={INPUT} aria-label="Day name" />
          </label>
          {slots.length === 0 ? (
            <div className="grid gap-3 py-6 text-center">
              <p className="text-subhead text-label-2">No exercises yet. Fill this day or add one.</p>
              <Button onClick={() => setMode({ kind: 'fill' })}>Fill this day</Button>
            </div>
          ) : (
            <List>
              {slots.map((slot, i) => (
                <SlotRow
                  key={slot.id}
                  data={data}
                  slot={slot}
                  first={i === 0}
                  last={i === slots.length - 1}
                  onRole={(role) => change((s) => setRole(s, day, i, role))}
                  onMove={(dir) => change((s) => moveEntry(s, day, i, i + dir))}
                  onRemove={() => change((s) => removeEntry(s, day, i))}
                  onAddAlternate={() => setMode({ kind: 'alt', slot: i })}
                  onRemoveAlternate={(id) => change((s) => removeAlternate(s, day, i, id))}
                />
              ))}
            </List>
          )}
          <Button variant="tinted" onClick={() => setMode({ kind: 'add' })}>
            <Plus className="size-5" /> Add exercise
          </Button>
          <p className={guide.over ? 'text-center text-footnote text-orange' : 'text-center text-footnote text-label-2'}>{guide.text}</p>
        </div>
      )}
    </Sheet>
  );
}
