import { allExercises, getExercise } from './catalogue';
import { recommend } from './progression';
import { SPLITS } from './splits';
import type { AppData, EquipmentKind, Exercise, PlannedExercise, PlannedSession, Prescription, Profile, Slot, SplitId } from './types';

export const planKey = (splitId: SplitId, sessionIndex: number, cycle: number) => `${splitId}:${sessionIndex}:${cycle}`;

const MAX_EXERCISES: Record<AppData['profile']['sessionMinutes'], number> = { 45: 5, 60: 6, 75: 7, 90: 8 };

/** Appended after a session's own slots when it lacks the pattern; longer sessions reach them. */
const FINISHERS: Slot[] = [
  { id: 'f-calves', pattern: 'calves', role: 'accessory', candidates: ['standing-calf-raise', 'seated-calf-raise'] },
  { id: 'f-core', pattern: 'core', role: 'accessory', candidates: ['hanging-knee-raise', 'plank', 'cable-crunch', 'dead-bug'] },
  { id: 'f-arms', pattern: 'arms', role: 'accessory', candidates: ['db-curl', 'triceps-pushdown', 'hammer-curl', 'cable-curl'] },
];

/** Beginners start on machines and dumbbells, which are easier to learn and load safely. */
const BEGINNER_ORDER: Record<EquipmentKind, number> = { machine: 0, dumbbell: 1, cable: 2, bodyweight: 3, barbell: 4 };

const RX: Record<Profile['objective'], Record<Slot['role'], Omit<Prescription, 'restSec'>>> = {
  hypertrophy: { anchor: { sets: 3, repMin: 6, repMax: 10 }, accessory: { sets: 3, repMin: 10, repMax: 15 } },
  strength: { anchor: { sets: 4, repMin: 4, repMax: 6 }, accessory: { sets: 3, repMin: 8, repMax: 12 } },
  general: { anchor: { sets: 3, repMin: 8, repMax: 12 }, accessory: { sets: 3, repMin: 8, repMax: 12 } },
};
const REST: Record<Slot['role'], number> = { anchor: 150, accessory: 90 };

export function prescription(profile: Pick<Profile, 'objective' | 'experience'>, role: Slot['role'], ex: Exercise | undefined): Prescription {
  if (ex?.kind === 'timed') return { sets: 3, repMin: 30, repMax: 60, restSec: 60 };
  const base = RX[profile.objective][role];
  let sets = base.sets;
  if (profile.experience === 'beginner' && role === 'anchor') sets = Math.max(2, sets - 1);
  if (profile.experience === 'advanced' && role === 'accessory') sets += 1;
  return { ...base, sets, restSec: REST[role] };
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
  const rx = prescription(data.profile, slot.role, ex);
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

  const patterns = new Set(tmpl.slots.map((s) => s.pattern));
  const slots = [...tmpl.slots, ...FINISHERS.filter((f) => !patterns.has(f.pattern))];
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
  return [...SPLITS[splitId].sessions.flatMap((s) => s.slots), ...FINISHERS].find((s) => s.id === slotId);
}
