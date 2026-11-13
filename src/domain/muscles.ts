import dayjs from 'dayjs';
import { getExercise } from './catalogue';
import type { AppData, Exercise, Pattern } from './types';

export const MUSCLES = [
  'chest',
  'shoulders',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'traps',
  'lats',
  'lower-back',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  'rear-delts': 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  traps: 'Traps & upper back',
  lats: 'Lats',
  'lower-back': 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
};

interface Targets {
  primary: Muscle[];
  secondary: Muscle[];
}

const t = (primary: Muscle[], secondary: Muscle[] = []): Targets => ({ primary, secondary });

const ROWS = t(['lats', 'traps'], ['rear-delts', 'biceps']);
const PRESS = t(['chest'], ['shoulders', 'triceps']);
const OHP = t(['shoulders'], ['triceps']);
const CURL = t(['biceps'], ['forearms']);
const RDL = t(['hamstrings', 'glutes'], ['lower-back', 'forearms']);
const REAR = t(['rear-delts'], ['traps']);

/** Primary muscles count a full set, secondary half. */
const BY_ID: Record<string, Targets> = {
  'back-squat': t(['quads', 'glutes'], ['hamstrings', 'lower-back']),
  'front-squat': t(['quads'], ['glutes', 'abs']),
  'hack-squat': t(['quads'], ['glutes']),
  'leg-press': t(['quads'], ['glutes']),
  'goblet-squat': t(['quads'], ['glutes', 'abs']),
  'bulgarian-split-squat': t(['quads', 'glutes'], ['hamstrings']),
  'reverse-lunge': t(['quads', 'glutes'], ['hamstrings']),
  'leg-extension': t(['quads']),
  'romanian-deadlift': RDL,
  'db-romanian-deadlift': RDL,
  'hip-thrust': t(['glutes'], ['hamstrings']),
  'leg-curl': t(['hamstrings']),
  'cable-pull-through': t(['glutes'], ['hamstrings']),
  'back-extension': t(['lower-back', 'glutes'], ['hamstrings']),
  'bench-press': PRESS,
  'db-bench-press': PRESS,
  'incline-db-press': PRESS,
  'machine-chest-press': PRESS,
  'cable-fly': t(['chest'], ['shoulders']),
  'push-up': t(['chest'], ['shoulders', 'triceps', 'abs']),
  dip: t(['chest', 'triceps'], ['shoulders']),
  'overhead-press': t(['shoulders'], ['triceps', 'traps']),
  'seated-db-press': OHP,
  'machine-shoulder-press': OHP,
  'chest-supported-row': ROWS,
  'seated-cable-row': ROWS,
  'one-arm-db-row': t(['lats'], ['traps', 'biceps', 'rear-delts']),
  'barbell-row': t(['lats', 'traps'], ['lower-back', 'biceps', 'rear-delts']),
  'inverted-row': ROWS,
  'lat-pulldown': t(['lats'], ['biceps']),
  'pull-up': t(['lats'], ['biceps', 'forearms']),
  'chin-up': t(['lats', 'biceps'], ['forearms']),
  'straight-arm-pulldown': t(['lats']),
  'db-lateral-raise': t(['shoulders'], ['traps']),
  'cable-lateral-raise': t(['shoulders'], ['traps']),
  'face-pull': REAR,
  'rear-delt-fly': REAR,
  'reverse-pec-deck': REAR,
  'db-curl': CURL,
  'cable-curl': CURL,
  'hammer-curl': t(['biceps', 'forearms']),
  'triceps-pushdown': t(['triceps']),
  'overhead-triceps-extension': t(['triceps']),
  'standing-calf-raise': t(['calves']),
  'seated-calf-raise': t(['calves']),
  plank: t(['abs'], ['obliques']),
  'hanging-knee-raise': t(['abs'], ['forearms']),
  'cable-crunch': t(['abs']),
  'dead-bug': t(['abs'], ['obliques']),
  'muscle-up': t(['lats'], ['chest', 'triceps', 'biceps']),
  'archer-pull-up': t(['lats'], ['biceps']),
  'front-lever': t(['lats', 'abs'], ['traps']),
  'back-lever': t(['lats', 'chest'], ['biceps', 'shoulders']),
  'dead-hang': t(['forearms'], ['lats']),
  'skin-the-cat': t(['shoulders'], ['lats', 'abs']),
  'ring-dip': t(['chest', 'triceps'], ['shoulders']),
  'archer-push-up': t(['chest'], ['triceps', 'shoulders']),
  planche: t(['shoulders'], ['chest', 'abs']),
  handstand: t(['shoulders'], ['traps', 'abs']),
  'handstand-push-up': t(['shoulders', 'triceps'], ['traps']),
  'pike-push-up': t(['shoulders'], ['triceps']),
  'pistol-squat': t(['quads', 'glutes'], ['abs']),
  'nordic-curl': t(['hamstrings']),
  'human-flag': t(['obliques', 'lats'], ['shoulders']),
  'l-sit': t(['abs'], ['obliques']),
  'hollow-hold': t(['abs'], ['obliques']),
  'toes-to-bar': t(['abs'], ['lats', 'forearms']),
  'dragon-flag': t(['abs'], ['obliques']),
};

const BY_PATTERN: Record<Pattern, Targets> = {
  knee: t(['quads'], ['glutes']),
  hip: t(['hamstrings', 'glutes'], ['lower-back']),
  hpush: PRESS,
  vpush: OHP,
  hpull: ROWS,
  vpull: t(['lats'], ['biceps']),
  shoulders: t(['shoulders']),
  arms: CURL,
  calves: t(['calves']),
  core: t(['abs'], ['obliques']),
};

export function exerciseMuscles(ex: Exercise): Targets {
  const known = BY_ID[ex.id];
  if (known) return known;
  // Custom arm work could be either side of the arm; the muscle text says which.
  if (ex.pattern === 'arms') {
    if (/tricep/i.test(ex.muscle)) return t(['triceps']);
    if (/forearm|grip/i.test(ex.muscle)) return t(['forearms']);
  }
  return BY_PATTERN[ex.pattern];
}

/** Effective sets that light a muscle fully. */
const FULL_SETS = 8;
const WINDOW_DAYS = 7;

export interface Heat {
  /** 0 to 1: recent volume, fading to nothing over a week. */
  heat: number;
  /** Weighted sets in the last 7 days. */
  sets: number;
  /** Local date of the last finished workout that hit this muscle, any time. */
  last: string | null;
}

export function muscleHeat(data: AppData, now: string): Record<Muscle, Heat> {
  const today = dayjs(now).startOf('day');
  const out = Object.fromEntries(MUSCLES.map((m) => [m, { heat: 0, sets: 0, last: null }])) as Record<Muscle, Heat>;
  for (const s of data.sessions) {
    if (!s.finishedAt) continue;
    const date = dayjs(s.startedAt).format('YYYY-MM-DD');
    const age = today.diff(dayjs(date), 'day');
    if (age < 0) continue;
    const fade = Math.max(0, 1 - age / WINDOW_DAYS);
    for (const e of s.exercises) {
      const ex = getExercise(e.exerciseId, data.customExercises);
      const n = e.sets.filter((x) => x.status === 'done').length;
      if (!ex || !n) continue;
      const { primary, secondary } = exerciseMuscles(ex);
      const hit = (m: Muscle, w: number) => {
        const h = out[m];
        if (!h.last || date > h.last) h.last = date;
        if (age >= WINDOW_DAYS) return;
        h.sets += n * w;
        h.heat += n * w * fade;
      };
      primary.forEach((m) => hit(m, 1));
      secondary.forEach((m) => hit(m, 0.5));
    }
  }
  for (const m of MUSCLES) out[m].heat = Math.min(1, out[m].heat / FULL_SETS);
  return out;
}
