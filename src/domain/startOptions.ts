import { getExercise } from './catalogue';
import { metaFor, primaryGroups } from './plan/v2/exerciseMeta';
import { focusGroups } from './plan/v2/groups';
import { buildPool } from './plan/v2/select';
import { addExercise, startSession } from './session';
import { setsFrom } from './training';
import type { AppData, SessionExercise, WorkoutSession } from './types';

export type StartMode = 'full' | 'short' | 'extra-sets' | 'extra-exercise';

/** Matches the workout clock (domain/eta): each set's work plus its rest, plus a warm-up. */
const WORK_SEC = 40;
const WARMUP_MIN = 5;
/** "Short on time" aims for about two thirds of the full session. */
const SHORT_SHARE = 0.65;

function exerciseSeconds(e: SessionExercise, data?: AppData): number {
  const ex = data ? getExercise(e.exerciseId, data.customExercises) : undefined;
  if (ex?.pattern === 'cardio') return e.plan?.repMin ?? 0;
  return e.sets.length * (WORK_SEC + (e.plan?.restSec ?? 90));
}

export function sessionMinutes(s: WorkoutSession, data?: AppData): number {
  return Math.round(WARMUP_MIN + s.exercises.reduce((t, e) => t + exerciseSeconds(e, data), 0) / 60);
}

const withSession = (data: AppData, s: WorkoutSession): AppData => ({ ...data, activeSession: s });

/** Keeps every main lift; drops extras from the end until the session is about two thirds as long. */
function shorten(data: AppData, s: WorkoutSession): WorkoutSession {
  const target = SHORT_SHARE * s.exercises.reduce((t, e) => t + exerciseSeconds(e, data), 0);
  const kept = [...s.exercises];
  let total = kept.reduce((t, e) => t + exerciseSeconds(e, data), 0);
  for (let i = kept.length - 1; i >= 0 && total > target; i--) {
    if (kept[i].role === 'anchor') continue;
    total -= exerciseSeconds(kept[i], data);
    kept.splice(i, 1);
  }
  return { ...s, exercises: kept };
}

/** One more set on main lifts and on exercises for the person's focus muscles. */
function extraSets(data: AppData, s: WorkoutSession): WorkoutSession {
  const focus = focusGroups(data.profile.focus);
  return {
    ...s,
    exercises: s.exercises.map((e) => {
      const ex = getExercise(e.exerciseId, data.customExercises);
      if (!ex || !e.plan || ex.pattern === 'cardio') return e;
      const forFocus = primaryGroups(metaFor(ex)).some((g) => focus.has(g));
      if (e.role !== 'anchor' && !forFocus) return e;
      const n = e.plan.sets + 1;
      const sets = e.rec ? setsFrom(e.rec, n, e.plan.repMin) : [...e.sets, { ...e.sets[e.sets.length - 1] }];
      return { ...e, plan: { ...e.plan, sets: n }, sets };
    }),
  };
}

/** The best move for a focus muscle that today's session does not already have. */
function extraExerciseId(data: AppData, s: WorkoutSession): string | null {
  const have = new Set(s.exercises.map((e) => e.exerciseId));
  const focus = focusGroups(data.profile.focus);
  const today = new Set(s.exercises.flatMap((e) => {
    const ex = getExercise(e.exerciseId, data.customExercises);
    return ex ? primaryGroups(metaFor(ex)) : [];
  }));
  const wanted = focus.size ? focus : today;
  const options = buildPool(data)
    .filter((it) => it.ex.pattern !== 'cardio' && !have.has(it.ex.id) && !it.meta.compound && it.primary.some((g) => wanted.has(g)))
    .sort((a, b) => b.quality - a.quality || a.order - b.order);
  return options[0]?.ex.id ?? null;
}

/** Reshapes a just-started session for the time the person has today. */
export function applyStartMode(data: AppData, mode: StartMode): AppData {
  const s = data.activeSession;
  if (!s || mode === 'full') return data;
  if (mode === 'short') return withSession(data, shorten(data, s));
  if (mode === 'extra-sets') return withSession(data, extraSets(data, s));
  const id = extraExerciseId(data, s);
  return id ? addExercise(data, id) : data;
}

export interface StartChoice {
  mode: StartMode;
  label: string;
  detail: string;
  minutes: number;
}

/** What each way of starting today's planned session would look like. Options that change nothing are left out. */
export function startChoices(data: AppData, now: string): StartChoice[] {
  const base = startSession(data, now, 'preview');
  const full = base.activeSession;
  if (!full || data.activeSession) return [];
  const fullMin = sessionMinutes(full, data);
  const out: StartChoice[] = [{ mode: 'full', label: 'Full session', detail: `${full.exercises.length} exercises, as planned`, minutes: fullMin }];

  const short = shorten(base, full);
  if (short.exercises.length < full.exercises.length)
    out.push({ mode: 'short', label: 'Short on time', detail: 'Keeps every main lift, drops the last extras', minutes: sessionMinutes(short, data) });

  const more = extraSets(base, full);
  if (sessionMinutes(more, data) > fullMin) out.push({ mode: 'extra-sets', label: 'Extra sets', detail: '+1 set on main lifts and your focus muscles', minutes: sessionMinutes(more, data) });

  const id = extraExerciseId(base, full);
  if (id) {
    const added = addExercise(base, id).activeSession!;
    out.push({ mode: 'extra-exercise', label: 'Extra exercise', detail: `Adds ${getExercise(id, data.customExercises)?.name ?? 'one more move'}`, minutes: sessionMinutes(added, data) });
  }
  return out;
}
