import { activeFast, elapsedHours, endFast, fastPhase } from '@/domain/fasting';
import type { AppData } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { act } from '@/store/app';
import { endFastToast } from '../FastSheet';

const R = 30;
const C = 2 * Math.PI * R;

/** Running fast: elapsed against target, current phase. */
export function FastCard({ data, now }: { data: AppData; now: string }) {
  const fast = activeFast(data);
  if (!fast) return null;
  const h = elapsedHours(fast, now);
  const frac = Math.min(1, h / fast.targetHours);
  const done = h >= fast.targetHours;
  return (
    <Card className="mt-4 flex items-center gap-4 p-4">
      <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={R} fill="none" stroke="var(--color-fill)" strokeWidth="8" />
        <circle cx="36" cy="36" r={R} fill="none" stroke="#34C759" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="text-footnote font-semibold uppercase tracking-wide text-green">{done ? 'Target reached' : 'Fasting'}</div>
        <div className="text-title3 font-bold tabular">
          {Math.floor(h)}h {Math.floor((h % 1) * 60)}m of {fast.targetHours}h
        </div>
        <div className="text-subhead text-label-2">{fastPhase(h)}</div>
      </div>
      <Button
        variant={done ? 'success' : 'gray'}
        size="sm"
        onClick={() => {
          act((d) => endFast(d, now));
          endFastToast(h, fast.targetHours);
        }}
      >
        End fast
      </Button>
    </Card>
  );
}
