import dayjs from 'dayjs';
import { energy, intakeAdvice } from '@/domain/plan';
import type { Profile } from '@/domain/types';
import { Card } from '@/components/ui/card';

const fmt = (n: number) => n.toLocaleString();


function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-footnote text-label-2">{label}</div>
      <div className="whitespace-nowrap">
        <span className="text-title3 font-bold tabular">{value}</span> <span className="text-footnote text-label-2">{unit}</span>
      </div>
    </div>
  );
}

/** Maintenance, target and protein from the profile. Calories need sex and age; protein needs only height. */
export function EnergyCard({ profile, kg }: { profile: Profile; kg: number }) {
  const r = energy(profile, kg, dayjs().year());
  if (!r.proteinG) return null;
  const e = r.energy;
  const line = e ? intakeAdvice(e, profile) : null;
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        {e && <Stat label="Maintenance" value={fmt(e.tdee)} unit="kcal" />}
        {e && <Stat label="Daily target" value={fmt(e.target)} unit="kcal" />}
        <Stat label="Protein" value={String(r.proteinG)} unit="g" />
      </div>
      {line && <p className="mt-3 text-subhead">{line}</p>}
      {e?.note && <p className="mt-2 text-subhead">{e.note}</p>}
      {!e && <p className="mt-3 text-subhead text-label-2">Add sex and age in Build my plan for a calorie estimate.</p>}
      <p className="mt-3 text-footnote text-label-3">Estimate, not medical advice.</p>
    </Card>
  );
}
