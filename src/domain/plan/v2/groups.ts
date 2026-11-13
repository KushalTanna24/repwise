import type { FocusArea } from '../../types';

/** Muscle groups that carry a weekly set target in plan v2. */
export type Group =
  | 'upper-chest'
  | 'chest'
  | 'lats'
  | 'upper-back'
  | 'traps'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'neck'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

export const GROUPS: Group[] = [
  'upper-chest',
  'chest',
  'lats',
  'upper-back',
  'traps',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'neck',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
];

export const MAJOR: ReadonlySet<Group> = new Set<Group>(['chest', 'lats', 'upper-back', 'quads', 'hamstrings', 'glutes']);

export const GROUP_LABEL: Record<Group, string> = {
  'upper-chest': 'Upper chest',
  chest: 'Chest',
  lats: 'Lats',
  'upper-back': 'Upper back',
  traps: 'Traps',
  'front-delts': 'Front delts',
  'side-delts': 'Side delts',
  'rear-delts': 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  neck: 'Neck',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
};

/** Front delts are left out of "shoulders": pressing already trains them. */
export const FOCUS_GROUPS: Record<FocusArea, Group[]> = {
  chest: ['upper-chest', 'chest'],
  back: ['lats', 'upper-back'],
  shoulders: ['side-delts', 'rear-delts'],
  arms: ['biceps', 'triceps'],
  legs: ['quads', 'hamstrings', 'calves'],
  glutes: ['glutes'],
  abs: ['abs'],
  'upper-chest': ['upper-chest'],
  'side-delts': ['side-delts'],
  lats: ['lats'],
  'traps-neck': ['traps', 'neck'],
  forearms: ['forearms'],
};

export function focusGroups(focus: FocusArea[] = []): Set<Group> {
  return new Set(focus.flatMap((f) => FOCUS_GROUPS[f] ?? []));
}

export type StyleId = 'full' | 'upper-lower' | 'ppl' | 'hybrid-ppl' | 'arnold' | 'pairs' | 'bro' | 'custom';

/** One day of a split cycle: the groups it trains, plus an optional cardio block at the end. */
export interface DayLayout {
  title: string;
  groups: Group[];
  cardio?: boolean;
}
