import { getExercise } from './catalogue';
import type { Exercise, Pattern, WorkoutSession } from './types';

export type Region = 'legs' | 'push' | 'pull' | 'other';

const REGION: Record<Pattern, Region> = {
  knee: 'legs',
  hip: 'legs',
  calves: 'legs',
  hpush: 'push',
  vpush: 'push',
  hpull: 'pull',
  vpull: 'pull',
  shoulders: 'other',
  arms: 'other',
  core: 'other',
};

export const region = (p: Pattern) => REGION[p];

/** Latest `doneAt` among an exercise's sets, in ms; null when nothing is done yet. */
export function lastDoneMs(sets: { doneAt?: string; status: string }[]): number | null {
  let last: number | null = null;
  for (const s of sets) if (s.status === 'done' && s.doneAt) last = Math.max(last ?? 0, Date.parse(s.doneAt));
  return last;
}

/**
 * Freestyle: the best next set when you hop between exercises.
 * Ranking, in order: a different body area from your last set, rested
 * (or not started), longest since its last set, main lifts, plan order.
 */
export function suggestNext(session: WorkoutSession, custom: Exercise[], now: string): { exIdx: number; setIdx: number } | null {
  const nowMs = Date.parse(now);
  const areaOf = (exerciseId: string) => {
    const ex = getExercise(exerciseId, custom);
    return ex ? region(ex.pattern) : 'other';
  };

  let lastArea: Region | null = null;
  let latest = -1;
  for (const e of session.exercises) {
    const t = lastDoneMs(e.sets);
    if (t != null && t > latest) [latest, lastArea] = [t, areaOf(e.exerciseId)];
  }

  const candidates = session.exercises
    .map((e, exIdx) => ({ e, exIdx, setIdx: e.sets.findIndex((s) => s.status === 'pending') }))
    .filter((c) => !c.e.skipped && c.e.exerciseId && c.setIdx >= 0)
    .map((c) => {
      const last = lastDoneMs(c.e.sets);
      const since = last == null ? Infinity : nowMs - last;
      const rest = (c.e.plan?.restSec ?? 90) * 1000;
      return {
        ...c,
        key: [
          lastArea != null && areaOf(c.e.exerciseId) === lastArea ? 1 : 0,
          since >= rest ? 0 : 1,
          -since,
          c.e.role === 'anchor' ? 0 : 1,
          c.exIdx,
        ],
      };
    });

  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] < b.key[i] ? -1 : 1;
    return 0;
  });
  return { exIdx: candidates[0].exIdx, setIdx: candidates[0].setIdx };
}
