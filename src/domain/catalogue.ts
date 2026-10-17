import type { AppData, EquipmentKind, Exercise } from './types';

type Row = [id: string, name: string, muscle: string, pattern: Exercise['pattern'], equipment: EquipmentKind, kind?: Exercise['kind'], aliases?: string[]];

const rows: Row[] = [
  // Knee dominant
  ['back-squat', 'Back squat', 'Quads', 'knee', 'barbell', 'weighted', ['Barbell squat']],
  ['front-squat', 'Front squat', 'Quads', 'knee', 'barbell'],
  ['hack-squat', 'Hack squat', 'Quads', 'knee', 'machine'],
  ['leg-press', 'Leg press', 'Quads', 'knee', 'machine', 'weighted', ['Leg press']],
  ['goblet-squat', 'Goblet squat', 'Quads', 'knee', 'dumbbell', 'weighted', ['Goblet squat']],
  ['bulgarian-split-squat', 'Bulgarian split squat', 'Quads & glutes', 'knee', 'dumbbell', 'weighted', ['Bulgarian split squat']],
  ['reverse-lunge', 'Reverse lunge', 'Quads & glutes', 'knee', 'dumbbell', 'weighted', ['Reverse lunge']],
  ['leg-extension', 'Leg extension', 'Quads', 'knee', 'machine', 'weighted', ['Leg extension']],
  // Hip dominant
  ['romanian-deadlift', 'Romanian deadlift', 'Hamstrings & glutes', 'hip', 'barbell', 'weighted', ['Romanian deadlift']],
  ['db-romanian-deadlift', 'Dumbbell Romanian deadlift', 'Hamstrings & glutes', 'hip', 'dumbbell', 'weighted', ['Dumbbell Romanian deadlift']],
  ['hip-thrust', 'Hip thrust', 'Glutes', 'hip', 'barbell'],
  ['leg-curl', 'Leg curl', 'Hamstrings', 'hip', 'machine', 'weighted', ['Leg curl']],
  ['cable-pull-through', 'Cable pull-through', 'Glutes', 'hip', 'cable'],
  ['back-extension', 'Back extension', 'Glutes & lower back', 'hip', 'bodyweight', 'bodyweight'],
  // Horizontal push
  ['bench-press', 'Bench press', 'Chest', 'hpush', 'barbell', 'weighted', ['Flat bench press']],
  ['db-bench-press', 'Dumbbell bench press', 'Chest', 'hpush', 'dumbbell'],
  ['incline-db-press', 'Incline dumbbell press', 'Upper chest', 'hpush', 'dumbbell', 'weighted', ['Incline dumbbell press']],
  ['machine-chest-press', 'Machine chest press', 'Chest', 'hpush', 'machine', 'weighted', ['Machine chest press']],
  ['cable-fly', 'Cable fly', 'Chest', 'hpush', 'cable', 'weighted', ['Cable fly']],
  ['push-up', 'Push-up', 'Chest', 'hpush', 'bodyweight', 'bodyweight', ['Push-ups']],
  ['dip', 'Dip', 'Chest & triceps', 'hpush', 'bodyweight', 'bodyweight', ['Dips']],
  // Vertical push
  ['overhead-press', 'Overhead press', 'Shoulders', 'vpush', 'barbell', 'weighted', ['Overhead press']],
  ['seated-db-press', 'Seated dumbbell press', 'Shoulders', 'vpush', 'dumbbell'],
  ['machine-shoulder-press', 'Machine shoulder press', 'Shoulders', 'vpush', 'machine'],
  // Horizontal pull
  ['chest-supported-row', 'Chest-supported row', 'Mid back', 'hpull', 'machine', 'weighted', ['Chest-supported row']],
  ['seated-cable-row', 'Seated cable row', 'Mid back', 'hpull', 'cable', 'weighted', ['Seated cable row']],
  ['one-arm-db-row', 'One-arm dumbbell row', 'Lats', 'hpull', 'dumbbell', 'weighted', ['One-arm dumbbell row']],
  ['barbell-row', 'Barbell row', 'Mid back', 'hpull', 'barbell'],
  ['inverted-row', 'Inverted row', 'Mid back', 'hpull', 'bodyweight', 'bodyweight'],
  // Vertical pull
  ['lat-pulldown', 'Lat pulldown', 'Lats', 'vpull', 'cable', 'weighted', ['Lat pulldown']],
  ['pull-up', 'Pull-up', 'Lats', 'vpull', 'bodyweight', 'bodyweight', ['Pull-ups']],
  ['chin-up', 'Chin-up', 'Lats & biceps', 'vpull', 'bodyweight', 'bodyweight'],
  ['straight-arm-pulldown', 'Straight-arm pulldown', 'Lats', 'vpull', 'cable', 'weighted', ['Straight-arm pulldown']],
  // Shoulders
  ['db-lateral-raise', 'Dumbbell lateral raise', 'Side delts', 'shoulders', 'dumbbell', 'weighted', ['Dumbbell lateral raise']],
  ['cable-lateral-raise', 'Cable lateral raise', 'Side delts', 'shoulders', 'cable', 'weighted', ['Cable lateral raise']],
  ['face-pull', 'Face pull', 'Rear delts', 'shoulders', 'cable', 'weighted', ['Face pull']],
  ['rear-delt-fly', 'Rear-delt fly', 'Rear delts', 'shoulders', 'dumbbell', 'weighted', ['Rear-delt fly']],
  ['reverse-pec-deck', 'Reverse pec deck', 'Rear delts', 'shoulders', 'machine'],
  // Arms
  ['db-curl', 'Dumbbell curl', 'Biceps', 'arms', 'dumbbell'],
  ['cable-curl', 'Cable curl', 'Biceps', 'arms', 'cable'],
  ['hammer-curl', 'Hammer curl', 'Biceps & forearms', 'arms', 'dumbbell'],
  ['triceps-pushdown', 'Triceps pushdown', 'Triceps', 'arms', 'cable'],
  ['overhead-triceps-extension', 'Overhead triceps extension', 'Triceps', 'arms', 'cable'],
  // Calves
  ['standing-calf-raise', 'Standing calf raise', 'Calves', 'calves', 'machine', 'weighted', ['Standing calf raise']],
  ['seated-calf-raise', 'Seated calf raise', 'Calves', 'calves', 'machine'],
  // Core
  ['plank', 'Plank', 'Core', 'core', 'bodyweight', 'timed', ['Plank']],
  ['hanging-knee-raise', 'Hanging knee raise', 'Abs', 'core', 'bodyweight', 'bodyweight'],
  ['cable-crunch', 'Cable crunch', 'Abs', 'core', 'cable'],
  ['dead-bug', 'Dead bug', 'Core', 'core', 'bodyweight', 'bodyweight', ['Dead bug']],
];

export const BUILTIN_EXERCISES: Exercise[] = rows.map(([id, name, muscle, pattern, equipment, kind = 'weighted', aliases]) => ({
  id,
  name,
  muscle,
  pattern,
  equipment,
  kind,
  ...(aliases ? { aliases } : {}),
}));

const byId = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string, custom: Exercise[]): Exercise | undefined {
  return byId.get(id) ?? custom.find((e) => e.id === id);
}

export function allExercises(data: Pick<AppData, 'customExercises'>): Exercise[] {
  return [...BUILTIN_EXERCISES, ...data.customExercises];
}

export const ALL_EQUIPMENT: EquipmentKind[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

export function emptyAppData(now: string): AppData {
  const zero = { sessionIndex: 0, cycle: 1 };
  return {
    schemaVersion: 4,
    profile: {
      units: 'kg',
      experience: 'intermediate',
      objective: 'hypertrophy',
      daysPerWeek: 3,
      sessionMinutes: 60,
      equipment: [...ALL_EQUIPMENT],
      excludedExerciseIds: [],
    },
    program: { splitId: null, rotation: { 'full-body-abc': { ...zero }, 'upper-lower': { ...zero }, ppl: { ...zero } } },
    customExercises: [],
    archivedExerciseIds: [],
    plannedSession: null,
    activeSession: null,
    sessions: [],
    extras: [],
    bodyweights: [],
    meta: { updatedAt: now },
  };
}
