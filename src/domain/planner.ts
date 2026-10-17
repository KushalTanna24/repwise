import { allExercises, getExercise } from './catalogue';
import { recommend } from './progression';
import { SPLITS } from './splits';
import type { AppData, Exercise, Objective, PlannedExercise, PlannedSession, Prescription, Slot, SplitId } from './types';

export const planKey = (splitId: SplitId, sessionIndex: number, cycle: number) => `${splitId}:${sessionIndex}:${cycle}`;

const MAX_EXERCISES: Record<AppData['profile']['sessionMinutes'], number> = { 45: 5, 60: 6, 75: 7 };

const RX: Record<Objective, Record<Slot['role'], Omit<Prescription, 'restSec'>>> = {
  hypertrophy: { anchor: { sets: 3, repMin: 6, repMax: 10 }, accessory: { sets: 3, repMin: 10, repMax: 15 } },
  strength: { anchor: { sets: 4, repMin: 4, repMax: 6 }, accessory: { sets: 3, repMin: 8, repMax: 12 } },
  general: { anchor: { sets: 3, repMin: 8, repMax: 12 }, accessory: { sets: 3, repMin: 8, repMax: 12 } },
};
const REST: Record<Slot['role'], number> = { anchor: 150, accessory: 90 };

export function prescription(objective: Objective, role: Slot['role'], ex: Exercise | undefined): Prescription {
  if (ex?.kind === 'timed') return { sets: 3, repMin: 30, repMax: 60, restSec: 60 };
  return { ...RX[objective][role], restSec: REST[role] };
}

export function isEligible(ex: Exercise | undefined, data: AppData): ex is Exercise {
  return (
    !!ex &&
    data.profile.equipment.includes(ex.equipment) &&
    !data.profile.excludedExerciseIds.includes(ex.id) &&
    !data.archivedExerciseIds.includes(ex.id)
  );
}

export function plannedExercise(data: AppData, slot: Slot, exerciseId: string): PlannedExercise {
  const ex = getExercise(exerciseId, data.customExercises);
  const rx = prescription(data.profile.objective, slot.role, ex);
  const rec = ex
    ? recommend(ex, rx, data.sessions)
    : { kind: 'first' as const, targetKg: null, targetReps: Array(rx.sets).fill(rx.repMin), reason: 'No option for your equipment. Pick one.' };
  return { exerciseId: ex ? exerciseId : '', slotId: slot.id, role: slot.role, ...rx, rec };
}

/** Deterministic: same data and rotation always give the same session. */
export function buildPlan(data: AppData, splitId: SplitId, variant = 0): PlannedSession {
  const split = SPLITS[splitId];
  const { sessionIndex, cycle } = data.program.rotation[splitId];
  const tmpl = split.sessions[sessionIndex % split.sessions.length];

  const chosen = new Set<string>();
  const picks = tmpl.slots.map((slot) => {
    const eligible = slot.candidates.filter((id) => !chosen.has(id) && isEligible(getExercise(id, data.customExercises), data));
    const id = eligible.length === 0 ? '' : slot.role === 'anchor' ? eligible[0] : eligible[(cycle - 1 + variant) % eligible.length];
    if (id) chosen.add(id);
    return { slot, id };
  });

  // Trim accessories from the end until the session fits its time budget.
  let room = MAX_EXERCISES[data.profile.sessionMinutes] - picks.filter((p) => p.slot.role === 'anchor').length;
  const kept = picks.filter((p) => p.slot.role === 'anchor' || room-- > 0);

  return {
    key: planKey(splitId, sessionIndex, cycle),
    splitId,
    sessionIndex,
    cycle,
    title: tmpl.title,
    exercises: kept.map((p) => plannedExercise(data, p.slot, p.id)),
    createdAt: data.meta.updatedAt,
    ...(variant ? { variant } : {}),
  };
}

/**
 * Rebuild: same main lifts, next set of accessories. Same rotation key, so
 * refresh keeps it. Null when no accessory has an alternative.
 */
export function rebuildPlan(data: AppData): AppData | null {
  const cur = data.plannedSession;
  if (!cur || data.activeSession) return null;
  const ids = (p: PlannedSession) => p.exercises.map((e) => e.exerciseId).join();
  for (let step = 1; step <= 6; step++) {
    const next = buildPlan(data, cur.splitId, (cur.variant ?? 0) + step);
    if (ids(next) !== ids(cur)) return { ...data, plannedSession: next };
  }
  return null;
}

/** Builds the next plan only when there is none or the rotation moved on. */
export function ensurePlan(data: AppData): AppData {
  const splitId = data.program.splitId;
  if (!splitId) return data.plannedSession ? { ...data, plannedSession: null } : data;
  const { sessionIndex, cycle } = data.program.rotation[splitId];
  if (data.plannedSession?.key === planKey(splitId, sessionIndex, cycle)) return data;
  return { ...data, plannedSession: buildPlan(data, splitId) };
}

/** Same movement pattern, slot candidates first; for swapping during a workout. */
export function swapCandidates(slot: Slot, data: AppData): Exercise[] {
  const all = allExercises(data).filter((e) => isEligible(e, data));
  const inSlot = slot.candidates.map((id) => all.find((e) => e.id === id)).filter((e): e is Exercise => !!e);
  const others = all.filter((e) => e.pattern === slot.pattern && !slot.candidates.includes(e.id));
  return [...inSlot, ...others];
}

export function findSlot(splitId: SplitId | null, slotId: string | null): Slot | undefined {
  if (!splitId || !slotId) return undefined;
  return SPLITS[splitId].sessions.flatMap((s) => s.slots).find((s) => s.id === slotId);
}
