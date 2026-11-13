import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { GROUP_LABEL, GROUPS, validateCustomPairs, type DayLayout, type Group, type Targets } from '@/domain/plan/v2';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';

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

/** Build your own days: which muscles go together, plus an optional cardio block. */
export function CustomPairsSheet({ open, onClose, initial, targets, days: perWeek, onSave }: Props) {
  const [days, setDays] = useState<DayLayout[]>(initial);
  // A fresh copy each time the sheet opens, so Cancel throws edits away.
  useEffect(() => {
    if (open) setDays(initial.map((d) => ({ ...d, groups: [...d.groups] })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const check = validateCustomPairs(days, targets, perWeek);
  const update = (i: number, patch: Partial<DayLayout>) => setDays((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const toggle = (i: number, g: Group) => update(i, { groups: days[i].groups.includes(g) ? days[i].groups.filter((x) => x !== g) : [...days[i].groups, g] });
  const named = days.every((d) => d.title.trim());

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
        <Button variant="plain" size="sm" className="font-semibold" disabled={!check.ok || !named} onClick={() => onSave(days.map((d) => ({ ...d, title: d.title.trim() })))}>
          Save
        </Button>
      }
    >
      <p className="px-1 pb-3 text-footnote text-label-2">Tap the muscles each day trains. Every muscle with a target needs a day.</p>
      {check.missing.length > 0 && <p className="px-1 pb-3 text-footnote text-red">Not on any day yet: {list(check.missing.map((g) => GROUP_LABEL[g].toLowerCase()))}.</p>}
      {check.lowFrequency.length > 0 && (
        <p className="px-1 pb-3 text-footnote text-orange">
          {list(check.lowFrequency.map((g) => GROUP_LABEL[g]))} trained about once a week. Fine for holding, slower for growing.
        </p>
      )}
      <div className="space-y-4">
        {days.map((d, i) => (
          <List key={i} className="p-3">
            <div className="flex items-center gap-2 pb-2">
              <span className="text-footnote font-semibold text-label-2">Day {i + 1}</span>
              <TextInput aria-label={`Day ${i + 1} name`} value={d.title} placeholder="Name this day" onChange={(e) => update(i, { title: e.target.value })} className="flex-1 text-left text-label" />
              <Button variant="plain" size="icon" aria-label={`Remove day ${i + 1}`} disabled={days.length <= 2} onClick={() => setDays((ds) => ds.filter((_, j) => j !== i))}>
                <Trash2 className="size-5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Day ${i + 1} muscles`}>
              {CHIPS.map((g) => {
                const on = d.groups.includes(g);
                return (
                  <Button key={g} size="sm" variant={on ? 'primary' : 'gray'} aria-pressed={on} onClick={() => toggle(i, g)}>
                    {GROUP_LABEL[g]}
                  </Button>
                );
              })}
              <Button size="sm" variant={d.cardio ? 'primary' : 'gray'} aria-pressed={!!d.cardio} onClick={() => update(i, { cardio: !d.cardio })}>
                Cardio
              </Button>
            </div>
            {check.emptyDays.includes(i) && <p className="pt-2 text-footnote text-red">Pick at least one muscle or cardio.</p>}
          </List>
        ))}
      </div>
      <Button variant="tinted" className="mt-4 w-full" disabled={days.length >= 7} onClick={() => setDays((ds) => [...ds, { title: `Day ${ds.length + 1}`, groups: [] }])}>
        <Plus className="mr-1 size-4" /> Add a day
      </Button>
    </Sheet>
  );
}
