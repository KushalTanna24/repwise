/** All loads are stored in kilograms. Pounds are a display concern only. */
export type Kg = number;

export type SplitId = 'full-body-abc' | 'upper-lower' | 'ppl' | 'ppl-hybrid';
export type Pattern =
  | 'knee'
  | 'hip'
  | 'hpush'
  | 'vpush'
  | 'hpull'
  | 'vpull'
  | 'shoulders'
  | 'arms'
  | 'calves'
  | 'core';
export type EquipmentKind = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
export type Objective = 'hypertrophy' | 'strength' | 'general';

export interface Exercise {
  /** Stable identity. Never changes, even when the name does. */
  id: string;
  name: string;
  muscle: string;
  pattern: Pattern;
  equipment: EquipmentKind;
  kind: 'weighted' | 'bodyweight' | 'timed';
  /** Legacy names used to map repwise_v2 history onto this id. */
  aliases?: string[];
  custom?: boolean;
  /** Bodyweight skill work; the picker lists these in their own group. */
  calisthenics?: boolean;
}

export interface Slot {
  id: string;
  pattern: Pattern;
  role: 'anchor' | 'accessory';
  candidates: string[];
}

export interface SplitDef {
  id: SplitId;
  name: string;
  blurb: string;
  /** `short` names the day in one-line summaries when the title's last word would not. */
  sessions: { title: string; short?: string; slots: Slot[] }[];
}

export interface Recommendation {
  targetKg: Kg | null;
  targetReps: number[];
  reason: string;
  kind: 'first' | 'hold' | 'increase' | 'reps' | 'deload' | 'assist';
  /** Bodyweight moves: suggested assistance or added load, when history supports it. */
  assistKg?: Kg | null;
  addedKg?: Kg | null;
}

export interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
}

export interface PlannedExercise extends Prescription {
  /** Empty string when no catalogue exercise fits the slot. */
  exerciseId: string;
  slotId: string;
  role: 'anchor' | 'accessory';
  rec: Recommendation;
}

export interface PlannedSession {
  key: string;
  splitId: SplitId;
  sessionIndex: number;
  cycle: number;
  title: string;
  exercises: PlannedExercise[];
  createdAt: string;
  /** Bumped by Rebuild to rotate accessories; anchors never change. */
  variant?: number;
  /** Set when built after a long break; loads and sets are eased. */
  returnTier?: 1 | 2 | 3;
}

export interface SetRecord {
  targetReps: number | null;
  targetKg: Kg | null;
  actualReps: number | null;
  actualKg: Kg | null;
  assistKg?: Kg | null;
  addedKg?: Kg | null;
  status: 'pending' | 'done' | 'skipped';
  note?: string;
  /** When the set was ticked; drives freestyle suggestions and recovery chips. */
  doneAt?: string;
}

export interface SessionExercise {
  exerciseId: string;
  slotId: string | null;
  role?: 'anchor' | 'accessory';
  plan: Prescription | null;
  rec: Recommendation | null;
  sets: SetRecord[];
  skipped?: boolean;
}

export interface WorkoutSession {
  id: string;
  planKey: string | null;
  splitId: SplitId | null;
  sessionIndex: number | null;
  cycle: number | null;
  title: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: SessionExercise[];
  note?: string;
}

export interface ExtraSession {
  id: string;
  date: string;
  type: 'run' | 'mobility' | 'skills';
  minutes?: number;
  distanceKm?: number;
  note?: string;
}

export interface Goal {
  id: string;
  title: string;
  /** Target date, local YYYY-MM-DD. */
  date: string;
}

export type SuppTiming = 'morning' | 'pre' | 'post' | 'meal' | 'night' | 'any';

export interface Supplement {
  /** Stable slug; renaming keeps history. */
  id: string;
  name: string;
  dose?: string;
  /** When in the day it is taken. Missing means any time. */
  timing?: SuppTiming;
  archived?: boolean;
}

export interface BodyWeight {
  id: string;
  date: string;
  kg: Kg;
}

export interface Profile {
  heightCm?: number;
  units: 'kg' | 'lb';
  experience: 'beginner' | 'intermediate' | 'advanced';
  objective: Objective;
  daysPerWeek: number;
  sessionMinutes: 45 | 60 | 75 | 90;
  equipment: EquipmentKind[];
  excludedExerciseIds: string[];
  goalNote?: string;
  targetWeightKg?: number;
  /** Daily water target in glasses. */
  waterGoal: number;
  /** Water nudges; hours are local. Missing means the defaults (off). */
  waterReminders?: { on: boolean; from: number; to: number; everyHours: number };
  /** Set once the long-fast safety note was acknowledged. */
  fastingSafetyAck?: boolean;
  /** 8 pm streak-at-risk push. Missing means on. */
  streakReminder?: boolean;
}

export interface ChallengeTask {
  id: string;
  label: string;
  kind: 'tick' | 'photo';
  /** Ticks itself from data the app already has. */
  auto?: 'workout' | 'workout-outdoor' | 'water';
  /** For auto 'water': glasses needed, otherwise the profile goal. */
  target?: number;
}

export interface ChallengeRun {
  id: string;
  templateId: '75-day' | 'habit-stack' | 'custom';
  title: string;
  /** Local date of day 1 of the current attempt. */
  startDate: string;
  days: number;
  rule: 'strict' | 'lenient';
  tasks: ChallengeTask[];
  /** Local date -> ticked task ids. Auto tasks are never stored. */
  ticks: Record<string, string[]>;
  status: 'active' | 'done' | 'failed' | 'quit';
  restarts: number;
  /** Habit stack only. */
  anchor?: string;
  /** Local date the run became done, failed or quit. */
  endedOn?: string;
  /** Day number that failed a strict run. */
  failedDay?: number;
  /** The restart prompt was answered. */
  failAck?: boolean;
}

export interface Fast {
  id: string;
  startedAt: string;
  endedAt: string | null;
  /** Whole hours, 1 to 72. */
  targetHours: number;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  /** Storage object path: {user_id}/{id}.jpg */
  path: string;
  challengeId?: string;
}

export interface LeaveRange {
  /** Local dates, inclusive; a null end is open-ended. */
  start: string;
  end: string | null;
}

export interface RotationState {
  sessionIndex: number;
  cycle: number;
}

export interface AppData {
  schemaVersion: 4;
  profile: Profile;
  program: {
    splitId: SplitId | null;
    rotation: Record<SplitId, RotationState>;
  };
  customExercises: Exercise[];
  archivedExerciseIds: string[];
  plannedSession: PlannedSession | null;
  activeSession: WorkoutSession | null;
  sessions: WorkoutSession[];
  extras: ExtraSession[];
  bodyweights: BodyWeight[];
  /** Glasses of water per local date (YYYY-MM-DD). */
  water: Record<string, number>;
  supplements: Supplement[];
  goals: Goal[];
  /** Supplement ids taken per local date. */
  suppLog: Record<string, string[]>;
  leave: LeaveRange[];
  challenges: ChallengeRun[];
  fasts: Fast[];
  photos: ProgressPhoto[];
  /** Badges already celebrated. Missing means back-fill with everything earned. */
  seenBadges?: string[];
  /** Written on every change for the server's streak nudge; the app never reads it. */
  streakHint: { date: string; current: number; lit: boolean } | null;
  meta: { updatedAt: string; migratedFrom?: 'repwise_v2'; migratedAt?: string; suppSeeded?: boolean };
}
