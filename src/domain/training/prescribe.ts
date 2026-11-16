import { getExercise } from '../catalogue';
import type { AppData, Exercise, Profile, SetRecord } from '../types';
import { daysOff, easedSets, recommend, returnTier, type ReturnTier } from './progression';
import type { Prescription, Recommendation, Slot } from './types';

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

export function setsFrom(rec: Recommendation, count: number, repMin: number): SetRecord[] {
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

export const tierAt = (data: AppData, now?: string): ReturnTier => (now ? returnTier(daysOff(data.sessions, now)) : 0);

/**
 * The one place an exercise's targets are decided: prescription for the role,
 * eased after a break, then the progression recommendation and its sets.
 * `now` dates the break since the last workout; omitted, no easing applies.
 */
export function prescribe(
  data: AppData,
  exerciseId: string,
  role: Slot['role'],
  now?: string,
): { exerciseId: string; plan: Prescription; rec: Recommendation; sets: SetRecord[] } {
  const ex = getExercise(exerciseId, data.customExercises);
  const base = prescription(data.profile, role, ex);
  const plan = { ...base, sets: easedSets(base.sets, tierAt(data, now)) };
  const rec: Recommendation = ex
    ? recommend(ex, plan, data.sessions, now)
    : { kind: 'first', targetKg: null, targetReps: Array(plan.sets).fill(plan.repMin), reason: 'No option for your equipment. Pick one.' };
  return { exerciseId: ex ? exerciseId : '', plan, rec, sets: setsFrom(rec, plan.sets, plan.repMin) };
}
