import { getExercise } from './catalogue';
import { findSlot, planKey, plannedExercise, prescription } from './planner';
import { recommend } from './progression';
import { SPLITS } from './splits';
import type { AppData, Profile, Recommendation, SessionExercise, SetRecord, SplitId, WorkoutSession } from './types';

function setsFrom(rec: Recommendation, count: number, repMin: number): SetRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    targetReps: rec.targetReps[i] ?? repMin,
    targetKg: rec.targetKg,
    actualReps: null,
    actualKg: null,
    // Assistance target lives on rec; null here only switches the UI to the assistance column.
    ...(rec.assistKg != null ? { assistKg: null } : {}),
    status: 'pending' as const,
  }));
}

/** Apply a change to one exercise of the active session. */
function withExercise(data: AppData, exIdx: number, fn: (e: SessionExercise) => SessionExercise | null): AppData {
  const s = data.activeSession;
  const ex = s?.exercises[exIdx];
  if (!s || !ex) return data;
  const next = fn(ex);
  if (!next) return data;
  return { ...data, activeSession: { ...s, exercises: s.exercises.map((e, i) => (i === exIdx ? next : e)) } };
}

function withSet(data: AppData, exIdx: number, setIdx: number, fn: (s: SetRecord, e: SessionExercise) => SetRecord | null): AppData {
  return withExercise(data, exIdx, (e) => {
    const set = e.sets[setIdx];
    if (!set) return null;
    const next = fn(set, e);
    return next ? { ...e, sets: e.sets.map((x, i) => (i === setIdx ? next : x)) } : null;
  });
}

export function startSession(data: AppData, now: string, id: string = crypto.randomUUID()): AppData {
  const plan = data.plannedSession;
  if (data.activeSession || !plan) return data;
  const session: WorkoutSession = {
    id,
    planKey: plan.key,
    splitId: plan.splitId,
    sessionIndex: plan.sessionIndex,
    cycle: plan.cycle,
    title: plan.title,
    startedAt: now,
    finishedAt: null,
    exercises: plan.exercises.map(({ rec, exerciseId, slotId, role, sets, repMin, repMax, restSec }) => ({
      exerciseId,
      slotId,
      role,
      plan: { sets, repMin, repMax, restSec },
      rec,
      sets: setsFrom(rec, sets, repMin),
    })),
  };
  return { ...data, activeSession: session };
}

export function updateSet(data: AppData, exIdx: number, setIdx: number, patch: Partial<SetRecord>): AppData {
  return withSet(data, exIdx, setIdx, (s) => ({ ...s, ...patch }));
}

/** Tick a set. Empty fields take the target; a weighted set needs some load. */
export function confirmSet(data: AppData, exIdx: number, setIdx: number, now?: string): AppData {
  return withSet(data, exIdx, setIdx, (s, e) => {
    const ex = getExercise(e.exerciseId, data.customExercises);
    if (!ex) return null;
    const reps = s.actualReps ?? s.targetReps;
    const kg = s.actualKg ?? s.targetKg ?? (ex.kind === 'weighted' ? null : 0);
    if (reps == null || (ex.kind === 'weighted' && kg == null)) return null;
    const assistKg = s.assistKg === null ? (e.rec?.assistKg ?? null) : s.assistKg;
    return { ...s, actualReps: reps, actualKg: ex.kind === 'timed' ? null : kg, ...(assistKg !== undefined ? { assistKg } : {}), ...(now ? { doneAt: now } : {}), status: 'done' };
  });
}

export function uncheckSet(data: AppData, exIdx: number, setIdx: number): AppData {
  return withSet(data, exIdx, setIdx, (s) => ({ ...s, status: 'pending' }));
}

export function skipSet(data: AppData, exIdx: number, setIdx: number): AppData {
  return withSet(data, exIdx, setIdx, (s) => ({ ...s, status: 'skipped' }));
}

export function addSet(data: AppData, exIdx: number): AppData {
  return withExercise(data, exIdx, (e) => {
    const last = e.sets.at(-1);
    const fresh: SetRecord = {
      targetReps: last?.targetReps ?? e.plan?.repMin ?? 8,
      targetKg: last?.targetKg ?? null,
      actualReps: null,
      actualKg: null,
      status: 'pending',
    };
    return { ...e, skipped: false, sets: [...e.sets, fresh] };
  });
}

export function removeSet(data: AppData, exIdx: number, setIdx: number): AppData {
  return withExercise(data, exIdx, (e) => (e.sets.length > 1 && e.sets[setIdx]?.status !== 'done' ? { ...e, sets: e.sets.filter((_, i) => i !== setIdx) } : null));
}

export function skipExercise(data: AppData, exIdx: number): AppData {
  return withExercise(data, exIdx, (e) => ({
    ...e,
    skipped: true,
    sets: e.sets.map((s) => (s.status === 'pending' ? { ...s, status: 'skipped' } : s)),
  }));
}

export function moveExercise(data: AppData, from: number, to: number): AppData {
  const s = data.activeSession;
  if (!s || from === to || !s.exercises[from] || to < 0 || to >= s.exercises.length) return data;
  const list = [...s.exercises];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return { ...data, activeSession: { ...s, exercises: list } };
}

export function addExercise(data: AppData, exerciseId: string): AppData {
  const s = data.activeSession;
  const ex = getExercise(exerciseId, data.customExercises);
  if (!s || !ex) return data;
  const rx = prescription(data.profile, 'accessory', ex);
  const rec = recommend(ex, rx, data.sessions);
  const entry: SessionExercise = { exerciseId, slotId: null, plan: rx, rec, sets: setsFrom(rec, rx.sets, rx.repMin) };
  return { ...data, activeSession: { ...s, exercises: [...s.exercises, entry] } };
}

/** Swap before any set is done; history stays tied to each exercise id. */
export function swapExercise(data: AppData, exIdx: number, exerciseId: string): AppData {
  const s = data.activeSession;
  return withExercise(data, exIdx, (e) => {
    if (e.sets.some((x) => x.status === 'done') || !getExercise(exerciseId, data.customExercises)) return null;
    const slot = findSlot(s!.splitId, e.slotId);
    const p = slot
      ? plannedExercise(data, slot, exerciseId)
      : { ...prescription(data.profile, 'accessory', getExercise(exerciseId, data.customExercises)), rec: null };
    const rx = { sets: p.sets, repMin: p.repMin, repMax: p.repMax, restSec: p.restSec };
    const rec = p.rec ?? recommend(getExercise(exerciseId, data.customExercises)!, rx, data.sessions);
    return { ...e, exerciseId, plan: rx, rec, skipped: false, sets: setsFrom(rec, rx.sets, rx.repMin) };
  });
}

function advance(data: AppData, splitId: SplitId): AppData {
  const len = SPLITS[splitId].sessions.length;
  const cur = data.program.rotation[splitId];
  const next = cur.sessionIndex + 1 >= len ? { sessionIndex: 0, cycle: cur.cycle + 1 } : { sessionIndex: cur.sessionIndex + 1, cycle: cur.cycle };
  return { ...data, plannedSession: null, program: { ...data.program, rotation: { ...data.program.rotation, [splitId]: next } } };
}

/**
 * The only path that records a workout. Advances the rotation exactly once,
 * and only when the session belongs to the rotation slot that is current.
 */
export function finishSession(data: AppData, now: string): AppData {
  const s = data.activeSession;
  if (!s) return data;
  if (data.sessions.some((x) => x.id === s.id)) return { ...data, activeSession: null };
  if (!s.exercises.some((e) => e.sets.some((x) => x.status === 'done'))) return data;

  const done: WorkoutSession = {
    ...s,
    finishedAt: now,
    exercises: s.exercises
      .filter((e) => e.exerciseId)
      .map((e) => ({ ...e, sets: e.sets.map((x) => (x.status === 'pending' ? { ...x, status: 'skipped' as const } : x)) })),
  };
  let next: AppData = { ...data, activeSession: null, sessions: [...data.sessions, done] };
  if (s.splitId && s.sessionIndex != null && s.cycle != null) {
    const rot = data.program.rotation[s.splitId];
    if (s.planKey === planKey(s.splitId, rot.sessionIndex, rot.cycle)) next = advance(next, s.splitId);
  }
  return next;
}

export function discardSession(data: AppData): AppData {
  return data.activeSession ? { ...data, activeSession: null } : data;
}

export function skipPlannedSession(data: AppData): AppData {
  const id = data.program.splitId;
  if (data.activeSession || !id) return data;
  return advance(data, id);
}

export function setSplit(data: AppData, splitId: SplitId): AppData {
  if (data.activeSession) return data;
  return { ...data, plannedSession: null, program: { ...data.program, splitId } };
}

export function editHistorySet(data: AppData, sessionId: string, exIdx: number, setIdx: number, patch: Partial<SetRecord>): AppData {
  return {
    ...data,
    sessions: data.sessions.map((s) =>
      s.id !== sessionId
        ? s
        : {
            ...s,
            exercises: s.exercises.map((e, i) =>
              i !== exIdx ? e : { ...e, sets: e.sets.map((x, j) => (j === setIdx ? { ...x, ...patch } : x)) },
            ),
          },
    ),
  };
}

export function deleteHistorySession(data: AppData, sessionId: string): AppData {
  return { ...data, sessions: data.sessions.filter((s) => s.id !== sessionId) };
}

/** Profile edits apply from the next unstarted workout; the plan is rebuilt, rotation untouched. */
export function updateProfile(data: AppData, patch: Partial<Profile>): AppData {
  return { ...data, profile: { ...data.profile, ...patch }, plannedSession: null };
}

/**
 * "Apply now" for profile changes mid-workout: exercises with nothing done yet
 * get the new prescription and targets. Anything with a done set is left alone.
 */
export function applyProfileToActive(data: AppData): AppData {
  const s = data.activeSession;
  if (!s) return data;
  const exercises = s.exercises.map((e) => {
    const slot = findSlot(s.splitId, e.slotId);
    if (!slot || !e.exerciseId || e.sets.some((x) => x.status === 'done')) return e;
    const p = plannedExercise(data, slot, e.exerciseId);
    const rx = { sets: p.sets, repMin: p.repMin, repMax: p.repMax, restSec: p.restSec };
    return { ...e, plan: rx, rec: p.rec, skipped: false, sets: setsFrom(p.rec, rx.sets, rx.repMin) };
  });
  return { ...data, activeSession: { ...s, exercises } };
}