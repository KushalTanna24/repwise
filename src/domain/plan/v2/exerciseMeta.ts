import { exerciseMuscles, type Muscle } from '../../muscles';
import type { Exercise, Pattern } from '../../types';
import type { Group } from './groups';

export interface ExerciseMeta {
  /** Weekly-set credit per group: primary mover 1, secondary 0.5 (Pelland 2024). */
  muscles: Partial<Record<Group, 1 | 0.5>>;
  /** How well the move trains its primary group: stable, loadable, full range. */
  tier: 'S' | 'A' | 'B';
  /** Loads the primary group at long length (Maeo 2021, Pedrosa 2022). */
  stretch: boolean;
  /** Whole-body cost; at most two high-fatigue lifts share a day. */
  fatigue: 'low' | 'medium' | 'high';
  /** High-skill lifts are left out of beginner plans. */
  skill: 'low' | 'high';
  compound: boolean;
}

type Muscles = ExerciseMeta['muscles'];
type Opts = Partial<Omit<ExerciseMeta, 'muscles' | 'tier'>>;

const compound = (muscles: Muscles, tier: ExerciseMeta['tier'], o: Opts = {}): ExerciseMeta => ({
  muscles,
  tier,
  stretch: false,
  fatigue: 'medium',
  skill: 'low',
  compound: true,
  ...o,
});
const iso = (muscles: Muscles, tier: ExerciseMeta['tier'], o: Opts = {}): ExerciseMeta => ({
  muscles,
  tier,
  stretch: false,
  fatigue: 'low',
  skill: 'low',
  compound: false,
  ...o,
});
const cardio: ExerciseMeta = iso({}, 'B');

const PRESS: Muscles = { chest: 1, 'front-delts': 0.5, triceps: 0.5 };
const INCLINE: Muscles = { 'upper-chest': 1, chest: 0.5, 'front-delts': 0.5, triceps: 0.5 };
const OHP: Muscles = { 'front-delts': 1, 'side-delts': 0.5, triceps: 0.5 };
const ROW: Muscles = { 'upper-back': 1, lats: 0.5, 'rear-delts': 0.5, biceps: 0.5 };
const PULLDOWN: Muscles = { lats: 1, biceps: 0.5, 'upper-back': 0.5 };
const SQUAT: Muscles = { quads: 1, glutes: 0.5 };
const HINGE: Muscles = { hamstrings: 1, glutes: 1 };

export const META: Record<string, ExerciseMeta> = {
  // Knee dominant
  'back-squat': compound(SQUAT, 'S', { fatigue: 'high', skill: 'high' }),
  'front-squat': compound({ quads: 1, glutes: 0.5, abs: 0.5 }, 'A', { fatigue: 'high', skill: 'high' }),
  'hack-squat': compound(SQUAT, 'S'),
  'leg-press': compound(SQUAT, 'A'),
  'goblet-squat': compound(SQUAT, 'B'),
  'bulgarian-split-squat': compound({ quads: 1, glutes: 1 }, 'A', { stretch: true }),
  'reverse-lunge': compound({ quads: 1, glutes: 1 }, 'B'),
  'leg-extension': iso({ quads: 1 }, 'A'),
  // Hip dominant
  'romanian-deadlift': compound({ ...HINGE, forearms: 0.5 }, 'S', { stretch: true, fatigue: 'high', skill: 'high' }),
  'db-romanian-deadlift': compound(HINGE, 'A', { stretch: true }),
  'hip-thrust': compound({ glutes: 1, hamstrings: 0.5 }, 'A'),
  'leg-curl': iso({ hamstrings: 1 }, 'A'),
  'cable-pull-through': compound({ glutes: 1, hamstrings: 0.5 }, 'B', { fatigue: 'low' }),
  'back-extension': compound({ glutes: 1, hamstrings: 0.5 }, 'B', { fatigue: 'low' }),
  'hip-abduction': iso({ glutes: 1 }, 'B'),
  'cable-glute-kickback': iso({ glutes: 1 }, 'B'),
  // Horizontal push
  'bench-press': compound(PRESS, 'S'),
  'db-bench-press': compound(PRESS, 'A', { stretch: true }),
  'incline-db-press': compound(INCLINE, 'S', { stretch: true }),
  'incline-barbell-press': compound(INCLINE, 'A'),
  'incline-machine-press': compound(INCLINE, 'A', { fatigue: 'low' }),
  'machine-chest-press': compound(PRESS, 'A', { fatigue: 'low' }),
  'cable-fly': iso({ chest: 1 }, 'S', { stretch: true }),
  'pec-deck': iso({ chest: 1 }, 'A', { stretch: true }),
  'push-up': compound(PRESS, 'B', { fatigue: 'low' }),
  dip: compound({ chest: 1, triceps: 1, 'front-delts': 0.5 }, 'A', { stretch: true }),
  // Vertical push
  'overhead-press': compound(OHP, 'A'),
  'seated-db-press': compound(OHP, 'A'),
  'machine-shoulder-press': compound(OHP, 'A', { fatigue: 'low' }),
  // Horizontal pull
  'chest-supported-row': compound(ROW, 'S', { fatigue: 'low' }),
  'seated-cable-row': compound(ROW, 'A', { stretch: true }),
  'one-arm-db-row': compound({ lats: 1, 'upper-back': 0.5, biceps: 0.5, 'rear-delts': 0.5 }, 'A', { stretch: true }),
  'barbell-row': compound({ 'upper-back': 1, lats: 1, biceps: 0.5, 'rear-delts': 0.5 }, 'A', { fatigue: 'high', skill: 'high' }),
  'inverted-row': compound(ROW, 'B', { fatigue: 'low' }),
  // Vertical pull
  'lat-pulldown': compound(PULLDOWN, 'S', { stretch: true }),
  'pull-up': compound({ ...PULLDOWN, forearms: 0.5 }, 'S', { stretch: true }),
  'chin-up': compound({ lats: 1, biceps: 1, forearms: 0.5 }, 'A', { stretch: true }),
  'assisted-pull-up': compound(PULLDOWN, 'A', { stretch: true }),
  'straight-arm-pulldown': iso({ lats: 1 }, 'A', { stretch: true }),
  // Shoulders and traps
  'db-lateral-raise': iso({ 'side-delts': 1 }, 'S'),
  'cable-lateral-raise': iso({ 'side-delts': 1 }, 'S', { stretch: true }),
  'face-pull': iso({ 'rear-delts': 1, 'upper-back': 0.5 }, 'A'),
  'rear-delt-fly': iso({ 'rear-delts': 1 }, 'A'),
  'reverse-pec-deck': iso({ 'rear-delts': 1 }, 'S'),
  'db-shrug': iso({ traps: 1, forearms: 0.5 }, 'A'),
  'barbell-shrug': iso({ traps: 1, forearms: 0.5 }, 'A'),
  // Neck
  'plate-neck-curl': iso({ neck: 1 }, 'A'),
  'plate-neck-extension': iso({ neck: 1 }, 'A'),
  // Arms
  'db-curl': iso({ biceps: 1, forearms: 0.5 }, 'A'),
  'cable-curl': iso({ biceps: 1, forearms: 0.5 }, 'A'),
  'hammer-curl': iso({ biceps: 1, forearms: 1 }, 'A'),
  'preacher-curl': iso({ biceps: 1 }, 'A', { stretch: true }),
  'incline-db-curl': iso({ biceps: 1 }, 'S', { stretch: true }),
  'triceps-pushdown': iso({ triceps: 1 }, 'A'),
  'overhead-triceps-extension': iso({ triceps: 1 }, 'S', { stretch: true }),
  'skull-crusher': iso({ triceps: 1 }, 'A', { stretch: true }),
  'wrist-curl': iso({ forearms: 1 }, 'A'),
  'reverse-curl': iso({ forearms: 1, biceps: 0.5 }, 'A'),
  // Calves
  'standing-calf-raise': iso({ calves: 1 }, 'S', { stretch: true }),
  'seated-calf-raise': iso({ calves: 1 }, 'A'),
  // Core
  plank: iso({ abs: 1 }, 'B'),
  'hanging-knee-raise': iso({ abs: 1, forearms: 0.5 }, 'A'),
  'cable-crunch': iso({ abs: 1 }, 'S'),
  'dead-bug': iso({ abs: 1 }, 'B'),
  // Cardio
  'incline-walk': cardio,
  bike: cardio,
  rower: cardio,
  stairs: cardio,
  run: cardio,
};

const COMPOUND_PATTERNS = new Set<Pattern>(['knee', 'hip', 'hpush', 'vpush', 'hpull', 'vpull']);

function groupFor(m: Muscle, pattern: Pattern): Group | null {
  switch (m) {
    case 'shoulders':
      return pattern === 'vpush' || pattern === 'hpush' ? 'front-delts' : 'side-delts';
    case 'obliques':
      return 'abs';
    case 'lower-back':
      return null;
    default:
      return m;
  }
}

/** Metadata for any exercise; custom ones are derived from the muscle map with cautious defaults. */
export function metaFor(ex: Exercise): ExerciseMeta {
  const known = META[ex.id];
  if (known) return known;
  const { primary, secondary } = exerciseMuscles(ex);
  const muscles: Muscles = {};
  for (const m of secondary) {
    const g = groupFor(m, ex.pattern);
    if (g) muscles[g] = 0.5;
  }
  for (const m of primary) {
    const g = groupFor(m, ex.pattern);
    if (g) muscles[g] = 1;
  }
  return { muscles, tier: 'B', stretch: false, fatigue: 'medium', skill: 'low', compound: COMPOUND_PATTERNS.has(ex.pattern) };
}

export function primaryGroups(m: ExerciseMeta): Group[] {
  return (Object.entries(m.muscles) as [Group, number][]).filter(([, w]) => w === 1).map(([g]) => g);
}
