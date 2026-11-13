/** Test-only golden profiles for plan v2. Not imported by production code. */
import type { AppData, EquipmentKind, FocusArea, Profile } from '../../types';
import { dataWith, sessionOn, weekDay } from './fixtures';
import type { StyleId } from './groups';

export interface Golden {
  daysPerWeek: number;
  experience: Profile['experience'];
  sessionMinutes: Profile['sessionMinutes'];
  focus: FocusArea[];
  style: StyleId | 'auto';
  sex?: Profile['sex'];
  planGoal?: Profile['planGoal'];
  bodyGoal?: Profile['bodyGoal'];
  equipment?: EquipmentKind[];
  excluded?: string[];
  history?: 'stalledLateralRaise8w';
}

export const GOLDEN: Record<string, Golden> = {
  ownerPairs5: { daysPerWeek: 5, experience: 'intermediate', sessionMinutes: 60, focus: ['chest', 'arms'], style: 'pairs' },
  femaleLook: { daysPerWeek: 4, experience: 'beginner', sessionMinutes: 60, sex: 'female', planGoal: 'look', focus: ['glutes', 'side-delts', 'lats'], style: 'auto' },
  maleLook: { daysPerWeek: 4, experience: 'intermediate', sessionMinutes: 60, sex: 'male', planGoal: 'look', focus: ['side-delts', 'lats', 'upper-chest'], style: 'auto' },
  beginner2: { daysPerWeek: 2, experience: 'beginner', sessionMinutes: 45, focus: [], style: 'auto' },
  advanced6: { daysPerWeek: 6, experience: 'advanced', sessionMinutes: 90, focus: ['side-delts'], style: 'ppl' },
  dumbbellsHome: { daysPerWeek: 3, experience: 'intermediate', sessionMinutes: 45, equipment: ['dumbbell', 'bodyweight'], focus: ['arms'], style: 'auto' },
  cutWithHistory: { daysPerWeek: 4, experience: 'intermediate', sessionMinutes: 60, bodyGoal: 'lose', focus: ['side-delts'], style: 'upper-lower', history: 'stalledLateralRaise8w' },
};

function stalledHistory() {
  // Four sessions a week for 8 weeks; the lateral raise climbs for 4 weeks, then stalls.
  return Array.from({ length: 8 }, (_, w) => {
    const weeksBack = 8 - w;
    const kg = Math.min(8 + w, 11);
    return [0, 1, 3, 4].map((day) =>
      sessionOn(weekDay(weeksBack, day), [
        { id: 'db-lateral-raise', kg, reps: 12, n: 3 },
        { id: 'bench-press', kg: 70 + w * 2.5, reps: 8, n: 3 },
        { id: 'lat-pulldown', kg: 55 + w * 2.5, reps: 10, n: 3 },
        { id: 'leg-press', kg: 120 + w * 5, reps: 10, n: 3 },
      ]),
    );
  }).flat();
}

export function dataFor(g: Golden): AppData {
  const d = dataWith(g.history ? stalledHistory() : [], {
    daysPerWeek: g.daysPerWeek,
    experience: g.experience,
    sessionMinutes: g.sessionMinutes,
    focus: g.focus,
    sex: g.sex,
    planGoal: g.planGoal,
    bodyGoal: g.bodyGoal,
    objective: 'hypertrophy',
    ...(g.equipment ? { equipment: g.equipment } : {}),
    ...(g.excluded ? { excludedExerciseIds: g.excluded } : {}),
  });
  return d;
}
