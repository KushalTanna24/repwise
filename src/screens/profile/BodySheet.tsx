import { useState } from 'react';
import { fromDisplay, parseNumber, toDisplay } from '@/domain/stats';
import { Sheet } from '@/components/ui/sheet';
import { List } from '@/components/ui/card';
import { FieldRow, Select, TextInput } from '@/components/ui/field';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';
import { Done } from './Done';

export function BodySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const p = data.profile;
  const [height, setHeight] = useState(p.heightCm ? String(p.heightCm) : '');
  const [target, setTarget] = useState(p.targetWeightKg ? String(toDisplay(p.targetWeightKg, p.units)) : '');
  const [goal, setGoal] = useState(p.goalNote ?? '');

  function commitHeight() {
    const cm = parseNumber(height);
    if (height && (cm == null || cm < 100 || cm > 250)) return toast('Height must be 100–250 cm');
    if ((cm ?? undefined) !== p.heightCm) act((d) => ({ ...d, profile: { ...d.profile, heightCm: cm ?? undefined } }));
  }
  function commitTarget() {
    const v = parseNumber(target);
    const kg = v == null ? undefined : +fromDisplay(v, p.units).toFixed(2);
    if (kg !== p.targetWeightKg) act((d) => ({ ...d, profile: { ...d.profile, targetWeightKg: kg } }));
  }

  return (
    <Sheet open={open} onClose={onClose} tall title="Body & water" right={<Done onClose={onClose} />}>
      <List>
        <FieldRow label="Height (cm)" hint="Used for BMI">
          <TextInput inputMode="decimal" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} onBlur={commitHeight} className="w-20" />
        </FieldRow>
        <FieldRow label={`Target weight (${p.units})`}>
          <TextInput inputMode="decimal" placeholder="Optional" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={commitTarget} className="w-24" />
        </FieldRow>
        <FieldRow label="Water goal" hint="Glasses of 250 ml a day">
          <Select
            label="Water goal"
            value={p.waterGoal}
            onChange={(waterGoal) => act((d) => ({ ...d, profile: { ...d.profile, waterGoal } }))}
            options={[4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map((n) => ({ value: n, label: `${n} glasses` }))}
          />
        </FieldRow>
        <label className="block px-4 py-3">
          <div className="text-body">Goal note</div>
          <div className="text-footnote text-label-2">Shown each time you open the app</div>
          <textarea
            rows={3}
            placeholder="e.g. 100 kg bench by March. Show up 3× a week."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={() => goal.trim() !== (p.goalNote ?? '') && act((d) => ({ ...d, profile: { ...d.profile, goalNote: goal.trim() || undefined } }))}
            className="mt-2 w-full resize-none rounded-[10px] bg-fill px-3 py-2 text-body outline-none placeholder:text-label-3 focus:ring-2 focus:ring-blue"
          />
        </label>
      </List>
    </Sheet>
  );
}
