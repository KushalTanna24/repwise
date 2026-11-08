import { allExercises, getExercise } from '../catalogue';
import type { AppData, EquipmentKind, Exercise } from '../types';
import { prescribe, tierAt } from './prescribe';
import { currentRotation, restartAfterBreak } from './rotation';
import { FINISHERS, getSplit } from './splits/registry';
import type { PlannedExercise, PlannedSession, Slot, SplitId } from './types';

export const planKey = (splitId: SplitId, sessionIndex: number, cycle: number) => `${splitId}:${sessionIndex}:${cycle}`;

const MAX_EXERCISES: Record<AppData['profile']['sessionMinutes'], number> = { 45: 5, 60: 6, 75: 7, 90: 8 };

/** Beginners start on machines and dumbbells, which are easier to learn and load safely. */
const BEGINNER_ORDER: Record<EquipmentKind, number> = { machine: 0, dumbbell: 1, cable: 2, bodyweight: 3, barbell: 4 };

export function isEligible(ex: Exercise | undefined, data: AppData): ex is Exercise {
  return (
    !!ex &&
    data.profile.equipment.includes(ex.equipment) &&
    !data.profile.excludedExerciseIds.includes(ex.id) &&
    !data.archivedExerciseIds.includes(ex.id)
  );
}

/** `now` dates the break since the last workout; omitted, no easing applies. */
export function plannedExercise(data: AppData, slot: Slot, exerciseId: string, now?: string): PlannedExercise {
  const { exerciseId: id, plan, rec } = prescribe(data, exerciseId, slot.role, now);
  return { exerciseId: id, slotId: slot.id, role: slot.role, ...plan, rec };
}

/** Deterministic: same data, rotation and `now` always give the same session. */
export function buildPlan(data: AppData, splitId: SplitId, variant = 0, now?: string): PlannedSession {
  const split = getSplit(data, splitId)!;
  const { sessionIndex, cycle } = currentRotation(data, splitId);
  const tmpl = split.sessions[sessionIndex % split.sessions.length];

  const patterns = new Set(tmpl.slots.map((s) => s.pattern));
  const slots = split.custom ? tmpl.slots : [...tmpl.slots, ...FINISHERS.filter((f) => !patterns.has(f.pattern))];
  const beginner = data.profile.experience === 'beginner';

  const chosen = new Set<string>();
  const picks = slots.map((slot) => {
    let eligible = slot.candidates.filter((id) => !chosen.has(id) && isEligible(getExercise(id, data.customExercises), data));
    if (beginner)
      eligible = [...eligible].sort((a, b) => BEGINNER_ORDER[getExercise(a, data.customExercises)!.equipment] - BEGINNER_ORDER[getExercise(b, data.customExercises)!.equipment]);
    const id = eligible.length === 0 ? '' : slot.role === 'anchor' ? eligible[0] : eligible[(cycle - 1 + variant) % eligible.length];
    if (id) chosen.add(id);
    return { slot, id };
  });

  // Trim accessories from the end until the session fits its time budget.
  let room = MAX_EXERCISES[data.profile.sessionMinutes] - picks.filter((p) => p.slot.role === 'anchor').length;
  const kept = split.custom ? picks : picks.filter((p) => p.slot.role === 'anchor' || room-- > 0);

  return {
    key: planKey(splitId, sessionIndex, cycle),
    splitId,
    sessionIndex,
    cycle,
    title: tmpl.title,
    exercises: kept.map((p) => plannedExercise(data, p.slot, p.id, now)),
    createdAt: data.meta.updatedAt,
    ...(variant ? { variant } : {}),
    ...(tierAt(data, now) ? { returnTier: tierAt(data, now) as 1 | 2 | 3 } : {}),
  };
}

/**
 * Rebuild: same main lifts, next set of accessories. Same rotation key, so
 * refresh keeps it. Null when no accessory has an alternative.
 */
export function rebuildPlan(data: AppData, now = new Date().toISOString()): AppData | null {
  const cur = data.plannedSession;
  if (!cur || data.activeSession || !getSplit(data, cur.splitId)) return null;
  const ids = (p: PlannedSession) => p.exercises.map((e) => e.exerciseId).join();
  for (let step = 1; step <= 6; step++) {
    const next = buildPlan(data, cur.splitId, (cur.variant ?? 0) + step, now);
    if (ids(next) !== ids(cur)) return { ...data, plannedSession: next };
  }
  return null;
}

/**
 * Builds the next plan only when there is none, the rotation moved on, or a
 * break changed how much to ease back in. Three weeks off restarts the split.
 */
export function ensurePlan(data: AppData, now = new Date().toISOString()): AppData {
  const splitId = data.program.splitId;
  if (!splitId || !getSplit(data, splitId)) return data.plannedSession ? { ...data, plannedSession: null } : data;
  const tier = tierAt(data, now);
  if (tier >= 2 && currentRotation(data, splitId).sessionIndex !== 0 && !data.activeSession) data = restartAfterBreak(data, splitId);
  const { sessionIndex, cycle } = currentRotation(data, splitId);
  const cur = data.plannedSession;
  if (cur?.key === planKey(splitId, sessionIndex, cycle) && (cur.returnTier ?? 0) === tier) return data;
  return { ...data, plannedSession: buildPlan(data, splitId, 0, now) };
}

/** Same movement pattern, slot candidates first; for swapping during a workout. */
export function swapCandidates(slot: Slot, data: AppData): Exercise[] {
  const all = allExercises(data).filter((e) => isEligible(e, data));
  const inSlot = slot.candidates.map((id) => all.find((e) => e.id === id)).filter((e): e is Exercise => !!e);
  const others = all.filter((e) => e.pattern === slot.pattern && !slot.candidates.includes(e.id));
  return [...inSlot, ...others];
}
