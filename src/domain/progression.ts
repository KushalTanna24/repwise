import dayjs from 'dayjs';
import type { EquipmentKind, Exercise, Kg, Recommendation, SetRecord, WorkoutSession } from './types';

/** Smallest practical load jump per equipment type. */
export const INCREMENT: Record<EquipmentKind, number> = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 2.5,
  cable: 2.5,
  bodyweight: 2.5,
};
const ASSIST_STEP = 5;
const TIMED_STEP = 5;

export const fmtKg = (kg: number) => `${+kg.toFixed(2)} kg`;
const roundTo = (x: number, step: number) => +(Math.round(x / step) * step).toFixed(2);
const fill = (n: number, v: number) => Array.from({ length: n }, () => v);

interface Rx {
  sets: number;
  repMin: number;
  repMax: number;
}

/** Done sets for one exercise in one session, in order. */
function doneSets(s: WorkoutSession, exerciseId: string): SetRecord[] {
  return s.exercises
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => e.sets)
    .filter((x) => x.status === 'done' && x.actualReps != null);
}

/** Most common load among the sets; ties resolve to the heavier load. */
function referenceKg(sets: SetRecord[]): Kg {
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.actualKg ?? 0, (counts.get(s.actualKg ?? 0) ?? 0) + 1);
  let best = 0;
  let bestN = -1;
  for (const [kg, c] of counts) if (c > bestN || (c === bestN && kg > best)) [best, bestN] = [kg, c];
  return best;
}

/** Calendar days from the last finished session to `now`; null with no history. */
export function daysOff(history: WorkoutSession[], now: string): number | null {
  const last = history.reduce<string | null>((m, s) => (s.finishedAt && (!m || s.finishedAt > m) ? s.finishedAt : m), null);
  return last ? dayjs(now).startOf('day').diff(dayjs(last).startOf('day'), 'day') : null;
}

/** 0 normal, 1 hold load (10+ days off), 2 ease 15% (21+), 3 ease 30% (43+). */
export type ReturnTier = 0 | 1 | 2 | 3;
export function returnTier(days: number | null): ReturnTier {
  if (days == null || days < 10) return 0;
  return days < 21 ? 1 : days < 43 ? 2 : 3;
}
const EASE: Record<ReturnTier, number> = { 0: 0, 1: 0, 2: 0.15, 3: 0.3 };

/** From three weeks off, one set fewer, never below two. */
export const easedSets = (sets: number, tier: ReturnTier) => (tier >= 2 ? Math.max(2, sets - 1) : sets);

/**
 * Rules-based double progression. Only finished sessions and sets the user
 * marked done count; everything else is invisible to the engine. With `now`,
 * a long break overrides progression and eases the load back in.
 */
export function recommend(ex: Exercise, rx: Rx, history: WorkoutSession[], now?: string): Recommendation {
  const relevant = history
    .filter((s) => s.finishedAt)
    .map((s) => ({ s, sets: doneSets(s, ex.id) }))
    .filter((x) => x.sets.length > 0)
    .sort((a, b) => a.s.startedAt.localeCompare(b.s.startedAt));

  const last = relevant.at(-1);
  if (!last) {
    return {
      kind: 'first',
      targetKg: null,
      targetReps: fill(rx.sets, rx.repMin),
      reason:
        ex.kind === 'timed'
          ? `First time: hold for ${rx.repMin}s with solid form.`
          : 'First time: pick a weight you could do ~2 more reps with.',
    };
  }

  const timed = ex.kind === 'timed';
  const reps = last.sets.map((x) => x.actualReps!).slice(0, rx.sets);
  const kg = timed ? null : referenceKg(last.sets);
  const inc = INCREMENT[ex.equipment];
  const unit = timed ? 's' : '';
  const loadLabel = kg == null ? 'the same hold' : ex.kind === 'bodyweight' && kg === 0 ? 'bodyweight' : fmtKg(kg);
  const clamp = (r: number) => Math.min(rx.repMax, Math.max(rx.repMin, r));

  const off = now ? daysOff(history, now) : null;
  const tier = returnTier(off);
  if (tier > 0) {
    const base = { targetReps: fill(rx.sets, rx.repMin) };
    if (timed) return { kind: 'hold', targetKg: null, ...base, reason: `Back after ${off} days. Start at ${rx.repMin}s holds.` };
    const assist = Math.max(0, ...last.sets.map((x) => x.assistKg ?? 0));
    if (tier === 1)
      return {
        kind: 'hold',
        targetKg: kg,
        ...(assist > 0 ? { assistKg: assist } : {}),
        ...base,
        reason: `Back after ${off} days. Same ${loadLabel} as last time, no jump yet.`,
      };
    if (assist > 0)
      return { kind: 'assist', targetKg: kg, assistKg: assist + ASSIST_STEP, ...base, reason: `Back after ${off} days. Use ${fmtKg(assist + ASSIST_STEP)} assistance.` };
    const eased = Math.max(0, roundTo(kg! * (1 - EASE[tier]), inc));
    return {
      kind: 'deload',
      targetKg: eased,
      ...base,
      reason: kg ? `Back after ${off} days. Eased ${EASE[tier] * 100}% to ${fmtKg(eased)}.` : `Back after ${off} days. Ease in with ${loadLabel}.`,
    };
  }

  // A set dropped by plan (easing back in) is not a missed set.
  const plannedLast = last.s.exercises.find((e) => e.exerciseId === ex.id)?.plan?.sets ?? rx.sets;
  if (last.sets.length < Math.min(rx.sets, plannedLast)) {
    return {
      kind: 'hold',
      targetKg: kg,
      targetReps: Array.from({ length: rx.sets }, (_, i) => clamp(reps[i] ?? rx.repMin)),
      reason: `Holding: only ${last.sets.length} of ${rx.sets} sets done last time.`,
    };
  }

  const belowMin = (sets: SetRecord[]) => sets.some((x) => x.actualReps! < rx.repMin);
  if (belowMin(last.sets)) {
    const prev = relevant.at(-2);
    const sameLoad = prev && (timed || referenceKg(prev.sets) === kg);
    if (prev && sameLoad && belowMin(prev.sets) && kg != null && kg > 0) {
      const down = Math.max(0, roundTo(kg - inc, inc));
      return {
        kind: 'deload',
        targetKg: down,
        targetReps: fill(rx.sets, rx.repMin),
        reason: `Two tough sessions at ${fmtKg(kg)}. Drop to ${fmtKg(down)}, rebuild.`,
      };
    }
    return { kind: 'hold', targetKg: kg, targetReps: fill(rx.sets, rx.repMin), reason: 'One off day. Same target.' };
  }

  if (reps.every((r) => r >= rx.repMax)) {
    if (timed) {
      const next = reps.map((r) => r + TIMED_STEP);
      return { kind: 'increase', targetKg: null, targetReps: next, reason: `Every hold hit ${rx.repMax}s. Add ${TIMED_STEP}s.` };
    }
    if (ex.kind === 'bodyweight') {
      const assist = Math.max(0, ...last.sets.map((x) => x.assistKg ?? 0));
      if (assist > 0) {
        const less = Math.max(0, assist - ASSIST_STEP);
        return {
          kind: 'assist',
          targetKg: kg,
          assistKg: less,
          targetReps: fill(rx.sets, rx.repMin),
          reason: `All sets hit ${rx.repMax} with ${fmtKg(assist)} assistance. Drop to ${fmtKg(less)}, aim for ${rx.repMin}.`,
        };
      }
      const added = roundTo((kg ?? 0) + inc, inc);
      return {
        kind: 'increase',
        targetKg: added,
        addedKg: added,
        targetReps: fill(rx.sets, rx.repMin),
        reason: `All sets hit ${rx.repMax}. Try +${fmtKg(added)} added, aim for ${rx.repMin}.`,
      };
    }
    const up = roundTo(kg! + inc, inc);
    return {
      kind: 'increase',
      targetKg: up,
      targetReps: fill(rx.sets, rx.repMin),
      reason: `All sets hit ${rx.repMax} at ${fmtKg(kg!)}. Up to ${fmtKg(up)}, aim for ${rx.repMin}.`,
    };
  }

  return {
    kind: 'reps',
    targetKg: kg,
    targetReps: Array.from({ length: rx.sets }, (_, i) => Math.min(rx.repMax, (reps[i] ?? rx.repMin - 1) + 1)),
    reason: `Keeping ${loadLabel}. Beat ${reps.map((r) => `${r}${unit}`).join(' · ')}.`,
  };
}
