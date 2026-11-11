import { exerciseMuscles, type Muscle } from '../muscles';
import { MAX_EXERCISES, prescription } from '../training';
import type { Exercise, FocusArea, Profile } from '../types';

/** Muscle groups that carry a weekly set target. Rear delts count as shoulders; lower back and forearms are trained indirectly. */
export type Group = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs';

export const GROUPS: Group[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];
export const MAJOR: ReadonlySet<Group> = new Set<Group>(['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes']);

export const GROUP_LABEL: Record<Group, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
};

export const FOCUS_GROUPS: Record<FocusArea, Group[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  legs: ['quads', 'hamstrings', 'calves'],
  glutes: ['glutes'],
  abs: ['abs'],
};

export const MUSCLE_GROUP: Partial<Record<Muscle, Group>> = {
  chest: 'chest',
  lats: 'back',
  traps: 'back',
  'rear-delts': 'shoulders',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abs: 'abs',
  obliques: 'abs',
};

/** Weekly sets one set of this exercise gives each group: primary 1, secondary 0.5 (Pelland 2024). */
export function exerciseGroups(ex: Exercise): Partial<Record<Group, number>> {
  const out: Partial<Record<Group, number>> = {};
  const { primary, secondary } = exerciseMuscles(ex);
  const add = (m: Muscle, w: number) => {
    const g = MUSCLE_GROUP[m];
    if (g) out[g] = Math.max(out[g] ?? 0, w);
  };
  primary.forEach((m) => add(m, 1));
  secondary.forEach((m) => add(m, 0.5));
  return out;
}

export function focusGroups(focus: FocusArea[] = []): Set<Group> {
  return new Set(focus.flatMap((f) => FOCUS_GROUPS[f]));
}

export function setsPerExercise(p: Pick<Profile, 'objective' | 'experience'>): number {
  return prescription(p, 'accessory', undefined).sets;
}

export function weeklyBudget(p: Profile): number {
  return p.daysPerWeek * MAX_EXERCISES[p.sessionMinutes] * setsPerExercise(p);
}

/** Below this a group is maintained, not grown (Bickel 2011). */
export const FLOOR = 6;

const BASE: Record<Profile['experience'], number> = { beginner: 10, intermediate: 12, advanced: 14 };

/** Targets before fitting them into the user's time. */
export function idealTargets(p: Profile): Record<Group, number> {
  const focus = focusGroups(p.focus);
  const cap = p.experience === 'beginner' ? 14 : 20;
  const factor = p.bodyGoal === 'lose' ? 1.25 : 1.5;
  const base = (g: Group) => BASE[p.experience] - (MAJOR.has(g) ? 0 : 2);
  return Object.fromEntries(GROUPS.map((g) => [g, focus.has(g) ? Math.min(cap, Math.round(base(g) * factor)) : base(g)])) as Record<Group, number>;
}

export interface Targets {
  sets: Record<Group, number>;
  focus: Set<Group>;
  budget: number;
}

/**
 * Weekly hard sets per group (Schoenfeld 2017, Pelland 2024). Focus groups get more,
 * then everything is trimmed to fit the time the user has: non-focus groups first,
 * down to the floor, then focus groups down to their base.
 */
export function weeklyTargets(p: Profile): Targets {
  const focus = focusGroups(p.focus);
  const budget = weeklyBudget(p);
  const base = (g: Group) => BASE[p.experience] - (MAJOR.has(g) ? 0 : 2);
  const sets = idealTargets(p);
  const total = () => GROUPS.reduce((a, g) => a + sets[g], 0);

  const trim = (pool: Group[], min: (g: Group) => number) => {
    while (total() > budget) {
      let pick: Group | null = null;
      for (const g of pool) if (sets[g] > min(g) && (!pick || sets[g] >= sets[pick])) pick = g;
      if (!pick) return;
      sets[pick] -= 1;
    }
  };
  trim(GROUPS.filter((g) => !focus.has(g)), () => FLOOR);
  trim(GROUPS.filter((g) => focus.has(g)), base);

  return { sets, focus, budget };
}
