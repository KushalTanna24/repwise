import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { GROUP_LABEL, GROUPS, validateCustomPairs, type DayLayout, type Group, type Targets } from '@/domain/plan/v2';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';

/** Front delts are trained by pressing; they are never a day of their own. */
const CHIPS: Group[] = GROUPS.filter((g) => g !== 'front-delts');

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

interface Props {
  open: boolean;
  onClose: () => void;
  initial: DayLayout[];
  targets: Targets;
  days: number;
  onSave: (pairs: DayLayout[]) => void;
}

/** Build your own days, one day at a time: which muscles go together, plus an optional cardio block. */
export function CustomPairsSheet({ open, onClose, initial, targets, days: perWeek, onSave }: Props) {
  const [days, setDays] = useState<DayLayout[]>(initial);
  const [at, setAt] = useState(0);
  // A fresh copy each time the sheet opens, so Cancel throws edits away.
  useEffect(() => {
    if (!open) return;
    setDays(initial.map((d) => ({ ...d, groups: [...d.groups] })));
    setAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const check = validateCustomPairs(days, targets, perWeek);
  // Only the muscles the person cares about are worth a warning.
  const rareFocus = check.lowFrequency.filter((g) => targets.focus.has(g));
  const named = days.every((d) => d.title.trim());
  const i = Math.min(at, days.length - 1);
  const d = days[i];
  const update = (patch: Partial<DayLayout>) => setDays((ds) => ds.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggle = (g: Group) => update({ groups: d.groups.includes(g) ? d.groups.filter((x) => x !== g) : [...d.groups, g] });
  const copyFrom = (j: number) => update({ groups: [...days[j].groups], cardio: days[j].cardio });
  const addDay = () => {
    setDays((ds) => [...ds, { title: `Day ${ds.length + 1}`, groups: [] }]);
    setAt(days.length);
  };
  const removeDay = () => {
    setDays((ds) => ds.filter((_, j) => j !== i));
    setAt(Math.max(0, i - 1));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title="Custom pairs"
      left={
        <Button variant="plain" size="sm" onClick={onClose}>
          Cancel
        </Button>
      }
      right={
        <Button variant="plain" size="sm" className="font-semibold" disabled={!check.ok || !named} onClick={() => onSave(days.map((x) => ({ ...x, title: x.title.trim() })))}>
          Save
        </Button>
      }
    >
      {/* Where you are in the week, and whether it is complete. */}
      <div className="flex gap-1.5 pb-3" role="tablist" aria-label="Days">
        {days.map((_, j) => (
          <button
            key={j}
            role="tab"
            aria-selected={j === i}
            aria-label={`Day ${j + 1}`}
            onClick={() => setAt(j)}
            className={cn(
              'h-9 min-w-9 rounded-full px-3 text-subhead font-semibold',
              j === i ? 'bg-blue text-white' : check.emptyDays.includes(j) ? 'bg-red/12 text-red' : 'bg-fill text-label',
            )}
          >
            {j + 1}
          </button>
        ))}
        {days.length < 7 && (
          <button onClick={addDay} aria-label="Add a day" className="flex size-9 items-center justify-center rounded-full bg-blue/12 text-blue">
            <Plus className="size-4" />
          </button>
        )}
      </div>

      {check.missing.length > 0 && <p className="pb-2 text-footnote text-red">Not on any day yet: {list(check.missing.map((g) => GROUP_LABEL[g].toLowerCase()))}.</p>}
      {rareFocus.length > 0 ? (
        <p className="pb-2 text-footnote text-orange">
          {list(rareFocus.map((g, k) => (k === 0 ? GROUP_LABEL[g] : GROUP_LABEL[g].toLowerCase())))} {rareFocus.length > 1 ? 'get' : 'gets'} one day a week. Fine for keeping,
          slower for growing.
        </p>
      ) : (
        check.lowFrequency.length > CHIPS.length / 2 && <p className="pb-2 text-footnote text-orange">Most muscles get one day a week. Fine for keeping, slower for growing.</p>
      )}

      <div className="mt-2 rounded-[14px] bg-card p-4">
        <div className="flex items-center gap-2">
          <Button variant="plain" size="icon" aria-label="Previous day" disabled={i === 0} onClick={() => setAt(i - 1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex-1 text-center text-footnote font-semibold text-label-2">
            Day {i + 1} of {days.length}
          </div>
          <Button variant="plain" size="icon" aria-label="Next day" disabled={i === days.length - 1} onClick={() => setAt(i + 1)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <TextInput
          aria-label={`Day ${i + 1} name`}
          value={d.title}
          placeholder="Name this day"
          onChange={(e) => update({ title: e.target.value })}
          className="mt-2 h-11 w-full rounded-[10px] bg-fill px-3 text-left text-headline font-semibold text-label"
        />
        <div className="mt-4 text-footnote font-semibold uppercase tracking-wide text-label-2">Muscles this day</div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Day ${i + 1} muscles`}>
          {CHIPS.map((g) => {
            const on = d.groups.includes(g);
            return (
              <Button key={g} variant={on ? 'primary' : 'gray'} aria-pressed={on} onClick={() => toggle(g)}>
                {GROUP_LABEL[g]}
              </Button>
            );
          })}
          <Button variant={d.cardio ? 'primary' : 'gray'} aria-pressed={!!d.cardio} onClick={() => update({ cardio: !d.cardio })}>
            Cardio
          </Button>
        </div>
        {check.emptyDays.includes(i) && <p className="pt-3 text-footnote text-red">Pick at least one muscle or cardio.</p>}

        {days.length > 1 && (
          <>
            <div className="mt-5 text-footnote font-semibold uppercase tracking-wide text-label-2">Same as another day?</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {days.map((_, j) =>
                j === i ? null : (
                  <Button key={j} variant="tinted" size="sm" onClick={() => copyFrom(j)}>
                    <Copy className="mr-1 size-3.5" /> Copy Day {j + 1}
                  </Button>
                ),
              )}
            </div>
          </>
        )}

        <Button variant="destructive" size="sm" className="mt-5" disabled={days.length <= 2} onClick={removeDay}>
          <Trash2 className="mr-1 size-3.5" /> Delete this day
        </Button>
      </div>
    </Sheet>
  );
}
