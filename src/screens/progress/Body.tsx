import { useState } from 'react';
import dayjs from 'dayjs';
import { Ellipsis, Scale } from 'lucide-react';
import { bmi, fromDisplay, parseNumber, toDisplay } from '@/domain/stats';
import { waterWeek } from '@/domain/water';
import { activeSupplements, suppStreak } from '@/domain/supplements';
import type { BodyWeight } from '@/domain/types';
import { Chart } from '@/components/Chart';
import { Button } from '@/components/ui/button';
import { Card, Empty, List, Row, SectionHeader } from '@/components/ui/card';
import { FieldRow, TextInput } from '@/components/ui/field';
import { Menu } from '@/components/ui/menu';
import { Segmented } from '@/components/ui/segmented';
import { confirm } from '@/components/ui/alert';
import { fmtDay, fmtLoad } from '@/lib/fmt';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';

const COLOR = '#FF2D55';
const RANGES = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, All: 0 } as const;
type Range = keyof typeof RANGES;

export function Body() {
  const data = useData();
  const units = data.profile.units;
  const [range, setRange] = useState<Range>('3M');
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [editing, setEditing] = useState<string | null>(null);

  const sorted = [...data.bodyweights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  const cutoff = RANGES[range] ? dayjs().subtract(RANGES[range], 'month').format('YYYY-MM-DD') : '';
  const shown = sorted.filter((w) => w.date >= cutoff);

  async function save() {
    const v = parseNumber(kg);
    const kgValue = v == null ? null : fromDisplay(v, units);
    if (kgValue == null || kgValue < 20 || kgValue > 350) return toast(`Enter a weight between ${toDisplay(20, units)} and ${toDisplay(350, units)} ${units}`);
    const clash = data.bodyweights.find((w) => w.date === date && w.id !== editing);
    if (clash) {
      const ok = await confirm({
        title: 'Replace weigh-in?',
        message: `${fmtDay(date)} already has ${fmtLoad(clash.kg, units)}. Replace it with ${v} ${units}?`,
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    const entry: BodyWeight = { id: editing ?? crypto.randomUUID(), date, kg: +kgValue.toFixed(2) };
    act((d) => ({ ...d, bodyweights: [...d.bodyweights.filter((w) => w.date !== date && w.id !== entry.id), entry] }));
    toast(editing ? 'Weigh-in updated' : 'Weigh-in saved');
    setKg('');
    setEditing(null);
    setDate(dayjs().format('YYYY-MM-DD'));
  }

  function edit(w: BodyWeight) {
    setEditing(w.id);
    setKg(String(toDisplay(w.kg, units)));
    setDate(w.date);
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(w: BodyWeight) {
    const ok = await confirm({ title: 'Delete weigh-in?', message: `${fmtLoad(w.kg, units)} on ${fmtDay(w.date)}`, confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    act((d) => ({ ...d, bodyweights: d.bodyweights.filter((x) => x.id !== w.id) }));
    toast('Deleted');
  }

  const change = latest && previous ? latest.kg - previous.kg : null;

  return (
    <>
      <Card className="mt-4 p-4">
        <div className="text-footnote font-semibold text-label-2">Body weight</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-largetitle font-bold tabular">{latest ? toDisplay(latest.kg, units) : '—'}</span>
          <span className="text-headline text-label-2">{units}</span>
        </div>
        <div className="text-footnote text-label-2">
          {latest ? `${fmtDay(latest.date)}${change != null ? ` · ${change > 0 ? '+' : change < 0 ? '−' : '±'}${fmtLoad(Math.abs(change), units)} since previous` : ''}` : 'Add your first weigh-in below'}
          {data.profile.targetWeightKg ? ` · goal ${fmtLoad(data.profile.targetWeightKg, units)}` : ''}
        </div>
        {sorted.length > 0 && (
          <>
            <Segmented
              className="mt-4"
              value={range}
              onChange={setRange}
              options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: r }))}
            />
            <div className="mt-3">
              {shown.length > 1 ? (
                <Chart points={shown.map((w) => ({ date: w.date, value: toDisplay(w.kg, units) }))} color={COLOR} unit={units} />
              ) : (
                <p className="py-10 text-center text-subhead text-label-2">
                  {shown.length === 1 ? 'One weigh-in in this range. Add another to see the trend.' : 'No weigh-ins in this range.'}
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      <SectionHeader title={editing ? 'Edit weigh-in' : 'Log weigh-in'} />
      <List>
        <FieldRow label={`Weight (${units})`}>
          <TextInput inputMode="decimal" placeholder={latest ? String(toDisplay(latest.kg, units)) : '60.0'} value={kg} onChange={(e) => setKg(e.target.value)} className="w-24" />
        </FieldRow>
        <FieldRow label="Date">
          <TextInput type="date" value={date} max={dayjs().format('YYYY-MM-DD')} onChange={(e) => setDate(e.target.value || date)} />
        </FieldRow>
      </List>
      <div className="mt-3 flex gap-3">
        {editing && (
          <Button variant="gray" className="flex-1" onClick={() => (setEditing(null), setKg(''), setDate(dayjs().format('YYYY-MM-DD')))}>
            Cancel
          </Button>
        )}
        <Button className="flex-1" onClick={save}>
          {editing ? 'Update' : 'Save weigh-in'}
        </Button>
      </div>

      <BmiCard heightCm={data.profile.heightCm} latest={latest} units={units} />

      <SectionHeader title="Water" />
      <WaterWeek />

      <SectionHeader title="Weigh-ins" />
      {sorted.length === 0 ? (
        <Card>
          <Empty icon={<Scale className="size-10" />} title="No weigh-ins yet" body="Weigh in at the same time of day for the cleanest trend." />
        </Card>
      ) : (
        <List>
          {[...sorted].reverse().map((w) => (
            <div key={w.id} className="flex items-center [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
              <Row title={fmtLoad(w.kg, units)} subtitle={dayjs(w.date).format('ddd D MMM YYYY')} className="flex-1" />
              <div className="pr-3">
                <Menu
                  label="Weigh-in options"
                  trigger={
                    <Button variant="plain" size="icon" aria-label="Weigh-in options">
                      <Ellipsis className="size-5" />
                    </Button>
                  }
                  items={[
                    { label: 'Edit', onSelect: () => edit(w) },
                    { label: 'Delete', onSelect: () => remove(w), destructive: true },
                  ]}
                />
              </div>
            </div>
          ))}
        </List>
      )}
    </>
  );
}

function BmiCard({ heightCm, latest, units }: { heightCm?: number; latest?: BodyWeight; units: 'kg' | 'lb' }) {
  const [h, setH] = useState('');
  const value = bmi(latest?.kg, heightCm);

  function saveHeight() {
    const cm = parseNumber(h);
    if (cm == null || cm < 100 || cm > 250) return toast('Enter height in cm, 100–250');
    act((d) => ({ ...d, profile: { ...d.profile, heightCm: cm } }));
    toast('Height saved');
  }

  return (
    <>
      <SectionHeader title="BMI" />
      <Card className="p-4">
        {!heightCm ? (
          <>
            <p className="text-subhead text-label-2">Add your height to calculate BMI from your latest weigh-in.</p>
            <div className="mt-3 flex gap-2">
              <input
                inputMode="decimal"
                placeholder="Height in cm"
                value={h}
                onChange={(e) => setH(e.target.value)}
                className="h-10 flex-1 rounded-[10px] bg-fill px-3 text-body outline-none focus:ring-2 focus:ring-blue"
              />
              <Button onClick={saveHeight}>Save</Button>
            </div>
          </>
        ) : !latest || value == null ? (
          <p className="text-subhead text-label-2">Log a weigh-in to calculate BMI with your height of {heightCm} cm.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-largetitle font-bold tabular">{value}</span>
              <span className="text-subhead text-label-2">kg/m²</span>
            </div>
            <p className="mt-1 text-footnote tabular text-label-2">
              {latest.kg} kg ÷ ({(heightCm / 100).toFixed(2)} m)² · weigh-in from {fmtDay(latest.date)}, height {heightCm} cm
              {units === 'lb' ? ` (${toDisplay(latest.kg, 'lb')} lb)` : ''}
            </p>
            <p className="mt-3 rounded-[12px] bg-fill-2 px-3 py-2 text-footnote text-label-2">
              BMI is a population screening number. It can't tell muscle from fat, so it reads high for many people who lift.
            </p>
          </>
        )}
      </Card>
    </>
  );
}

function WaterWeek() {
  const data = useData();
  const w = waterWeek(data, dayjs().format('YYYY-MM-DD'));
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-footnote font-semibold text-label-2">Daily average, last 7 days</div>
          <div className="text-title2 font-bold tabular">
            {w.avg} <span className="text-subhead font-normal text-label-2">glasses</span>
          </div>
        </div>
        <div className="text-right text-footnote text-label-2">
          Goal hit
          <div className="text-headline font-semibold tabular text-label">{w.daysHit}/7 days</div>
        </div>
      </div>
      <div className="mt-3">
        <Chart points={w.days.map((d) => ({ date: d.date, value: d.glasses }))} color="#007AFF" unit="glasses" kind="bar" height={150} />
      </div>
      <p className="mt-1 text-caption text-label-2">Goal {data.profile.waterGoal} glasses a day. Log from Today with one tap.</p>
      {activeSupplements(data).length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-sep pt-3">
          <span className="text-subhead text-label-2">Supplement streak</span>
          <span className="text-headline font-semibold tabular text-purple">{suppStreak(data, dayjs().format('YYYY-MM-DD'))} days</span>
        </div>
      )}
    </Card>
  );
}