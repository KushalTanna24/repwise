import { getExercise } from './catalogue';
import type { PlannedSession } from './training/types';
import type { Exercise, SessionExercise, WorkoutSession } from './types';

/** A set plus its rest, as the user actually trains: anything outside this is noise. */
const MIN_PACE_MS = 30_000;
const MAX_PACE_MS = 8 * 60_000;
/** Time under the bar for a rep-based set when nothing better is known. */
const WORK_SEC = 40;
/** Done sets in this workout before its own pace fully replaces the baseline. */
const TRUST_AFTER = 6;
const RECENT = 10;

export interface Eta {
  setsDone: number;
  setsLeft: number;
  remainingMs: number;
  /** Epoch ms. */
  endsAt: number;
  /** What the estimate mostly rests on. */
  basis: 'plan' | 'history' | 'session';
}

const clampPace = (ms: number) => Math.min(MAX_PACE_MS, Math.max(MIN_PACE_MS, ms));
const doneCount = (s: WorkoutSession) => s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.status === 'done').length, 0);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Typical time per done set across recent finished workouts; null without usable history. */
export function historyPaceMs(sessions: WorkoutSession[]): number | null {
  const paces = sessions
    .filter((s) => s.finishedAt && doneCount(s) >= 3)
    .map((s) => (Date.parse(s.finishedAt!) - Date.parse(s.startedAt)) / doneCount(s))
    .filter((p) => p >= MIN_PACE_MS && p <= MAX_PACE_MS)
    .slice(-RECENT);
  return paces.length ? median(paces) : null;
}

/** Planned cost of one pending set: its work plus the rest after it. */
function planSetMs(e: SessionExercise, targetReps: number | null, timed: boolean): number {
  const work = timed ? (targetReps ?? WORK_SEC) : WORK_SEC;
  return (work + (e.plan?.restSec ?? 90)) * 1000;
}

/**
 * When the active workout should end. Starts from past workouts (or the plan
 * when there are none) and leans on this workout's own pace as sets get done.
 */
export function estimateFinish(session: WorkoutSession, history: WorkoutSession[], now: number, custom: Exercise[] = []): Eta {
  let setsDone = 0;
  let lastDone: number | null = null;
  let planMs = 0;
  let setsLeft = 0;
  for (const e of session.exercises) {
    for (const s of e.sets) {
      if (s.status === 'done') {
        setsDone++;
        if (s.doneAt) lastDone = Math.max(lastDone ?? 0, Date.parse(s.doneAt));
      } else if (s.status === 'pending' && !e.skipped && e.exerciseId) {
        setsLeft++;
        planMs += planSetMs(e, s.targetReps, getExercise(e.exerciseId, custom)?.kind === 'timed');
      }
    }
  }

  if (setsLeft === 0) return { setsDone, setsLeft, remainingMs: 0, endsAt: now, basis: setsDone ? 'session' : 'plan' };

  const past = historyPaceMs(history);
  const baselineMs = past != null ? past * setsLeft : planMs;
  const anchor = lastDone ?? Date.parse(session.startedAt);
  const ownPace = lastDone != null && setsDone > 0 ? clampPace((lastDone - Date.parse(session.startedAt)) / setsDone) : null;
  const w = ownPace != null ? Math.min(1, setsDone / TRUST_AFTER) : 0;
  const total = Math.round(w * (ownPace ?? 0) * setsLeft + (1 - w) * baselineMs);

  // Time already spent on the set in progress counts, but never more than one set's worth.
  const perSet = total / setsLeft;
  const spent = Math.min(Math.max(0, now - anchor), perSet);
  const remainingMs = Math.round(total - spent);
  return { setsDone, setsLeft, remainingMs, endsAt: now + remainingMs, basis: w >= 0.5 ? 'session' : past != null ? 'history' : 'plan' };
}

/** How long a planned workout should take, before it starts. */
export function estimatePlanMs(plan: PlannedSession, history: WorkoutSession[], custom: Exercise[] = []): number {
  const session: WorkoutSession = {
    id: 'plan',
    planKey: plan.key,
    splitId: plan.splitId,
    sessionIndex: plan.sessionIndex,
    cycle: plan.cycle,
    title: plan.title,
    startedAt: new Date(0).toISOString(),
    finishedAt: null,
    exercises: plan.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      slotId: e.slotId,
      role: e.role,
      plan: { sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec },
      rec: e.rec,
      sets: Array.from({ length: e.sets }, () => ({ targetReps: e.repMin, targetKg: null, actualReps: null, actualKg: null, status: 'pending' as const })),
    })),
  };
  return estimateFinish(session, history, 0, custom).remainingMs;
}
