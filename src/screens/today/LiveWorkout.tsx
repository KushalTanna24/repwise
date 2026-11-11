import { useEffect, useState } from 'react';
import { estimateFinish, type Eta } from '@/domain/eta';
import type { AppData, WorkoutSession } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { fmtClock, fmtDuration } from '@/lib/fmt';
import { openSheet } from '@/lib/route';

/** Current time, re-read every `everyMs`. */
export function useNow(everyMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export const fmtClockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "~22 min left", "Almost done" or "All sets done". */
export function leftLabel(eta: Eta) {
  if (eta.setsLeft === 0) return 'All sets done';
  return eta.remainingMs < 60_000 ? 'Almost done' : `~${fmtDuration(eta.remainingMs)} left`;
}

export function useEta(data: AppData, s: WorkoutSession) {
  const now = useNow(15_000);
  return estimateFinish(s, data.sessions, now, data.customExercises);
}

function Bar({ eta }: { eta: Eta }) {
  const total = eta.setsDone + eta.setsLeft;
  const pct = total ? eta.setsDone / total : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={eta.setsDone} aria-label="Sets done">
      <div className="h-full rounded-full bg-green transition-[width] duration-500 ease-out" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

/** Folded card: progress bar plus the one number that matters, time left. */
export function LiveProgress({ data, s }: { data: AppData; s: WorkoutSession }) {
  const eta = useEta(data, s);
  return (
    <div className="mt-2.5">
      <Bar eta={eta} />
      <div className="mt-1.5 flex justify-between gap-3 text-footnote tabular text-label-2">
        <span>
          {eta.setsDone} of {eta.setsDone + eta.setsLeft} sets
        </span>
        <span className="font-semibold text-label">{leftLabel(eta)}</span>
      </div>
    </div>
  );
}

function Tile({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="min-w-0 text-center">
      <div className="text-caption font-semibold uppercase tracking-wide text-label-2">{label}</div>
      <div className="mt-0.5 truncate text-title2 font-bold tabular" aria-live={live ? 'off' : undefined}>
        {value}
      </div>
    </div>
  );
}

/** Open card: a running clock, time left and the finish time, then the bar. */
export function LivePanel({ data, s }: { data: AppData; s: WorkoutSession }) {
  const eta = useEta(data, s);
  const now = useNow(1000);
  const total = eta.setsDone + eta.setsLeft;
  const left = eta.setsLeft === 0 ? 'Done' : eta.remainingMs < 60_000 ? '<1 min' : fmtDuration(eta.remainingMs);
  return (
    <div className="mx-4 mt-3 rounded-[14px] bg-fill-2 p-3">
      <div className="grid grid-cols-3 divide-x divide-sep">
        <Tile label="Elapsed" value={fmtClock(now - Date.parse(s.startedAt))} live />
        <Tile label="Left" value={left} />
        <Tile label="Ends" value={eta.setsLeft ? fmtClockTime(eta.endsAt) : '—'} />
      </div>
      <div className="mt-3">
        <Bar eta={eta} />
        <div className="mt-1.5 flex justify-between text-footnote tabular text-label-2">
          <span>
            {eta.setsDone} of {total} sets
          </span>
          <span>{eta.basis === 'session' ? 'From your pace today' : eta.basis === 'history' ? 'From recent workouts' : 'From planned rests'}</span>
        </div>
      </div>
    </div>
  );
}

/** Folded: carries the clock. Open: the panel has the clock, so the button just says what it does. */
export function ResumeButton({ startedAt, showClock }: { startedAt: string; showClock: boolean }) {
  const now = useNow(1000);
  return (
    <Button size="lg" variant="success" aria-label="Resume workout" onClick={() => openSheet('workout')}>
      {showClock ? `Resume · ${fmtClock(now - Date.parse(startedAt))}` : 'Resume workout'}
    </Button>
  );
}
