import dayjs from 'dayjs';
import { localDate } from '../stats';
import { saveCustomSplit, setSplit, type CustomSplit } from '../training';
import type { Activity, AppData, BodyGoal, EquipmentKind, FocusArea, Objective, PlanGoal, Profile } from '../types';
import { estimateBodyFat, lookBodyGoal } from './body';
import type { DayLayout, StyleId } from './v2/groups';

export type { PlanGoal };

export interface PlanAnswers {
  heightCm: number;
  weightKg: number;
  sex?: 'male' | 'female';
  age?: number;
  goal: PlanGoal;
  activity: Activity;
  intakeKcal?: number;
  experience: Profile['experience'];
  daysPerWeek: number;
  sessionMinutes: Profile['sessionMinutes'];
  equipment: EquipmentKind[];
  focus: FocusArea[];
  /** Tape measurements for the look goal, in cm. */
  waistCm?: number;
  neckCm?: number;
  hipsCm?: number;
  style?: StyleId | 'auto';
  customPairs?: DayLayout[];
}

const OBJECTIVE: Record<PlanGoal, Objective> = { lose: 'hypertrophy', build: 'hypertrophy', strength: 'strength', fit: 'general', look: 'hypertrophy' };
const BODY_GOAL: Record<Exclude<PlanGoal, 'look'>, BodyGoal> = { lose: 'lose', build: 'gain', strength: 'maintain', fit: 'maintain' };

/** Focus prefilled for the look goal; the user can change it. */
export function lookPreset(sex?: 'male' | 'female'): FocusArea[] {
  if (sex === 'male') return ['side-delts', 'lats', 'upper-chest'];
  if (sex === 'female') return ['glutes', 'side-delts', 'lats'];
  return [];
}

/** Back from a profile, for prefilling a rerun. */
export function goalFromProfile(p: Profile): PlanGoal | undefined {
  if (p.planGoal) return p.planGoal;
  if (p.bodyGoal === 'lose') return 'lose';
  if (p.bodyGoal === 'gain') return 'build';
  if (p.objective === 'strength') return 'strength';
  if (p.bodyGoal === 'maintain') return 'fit';
  return undefined;
}

/** Writes the answers into the profile and logs today's weigh-in. Plans are rebuilt from the new profile. */
export function applyAnswers(data: AppData, a: PlanAnswers, now: string): AppData {
  const date = localDate(now);
  const profile: Profile = {
    ...data.profile,
    heightCm: a.heightCm,
    sex: a.sex,
    birthYear: a.age != null ? dayjs(now).year() - a.age : undefined,
    activity: a.activity,
    intakeKcal: a.intakeKcal,
    objective: OBJECTIVE[a.goal],
    planGoal: a.goal,
    experience: a.experience,
    daysPerWeek: a.daysPerWeek,
    sessionMinutes: a.sessionMinutes,
    equipment: a.equipment,
    focus: a.focus,
    waistCm: a.waistCm,
    neckCm: a.neckCm,
    hipsCm: a.hipsCm,
    planStyle: a.style ?? data.profile.planStyle,
    customPairs: a.customPairs ?? data.profile.customPairs,
    onboardedAt: now,
  };
  profile.bodyGoal = a.goal === 'look' ? lookBodyGoal(estimateBodyFat(profile, a.weightKg, dayjs(now).year()), a.sex) : BODY_GOAL[a.goal];
  const weighIn = { id: crypto.randomUUID(), date, kg: +a.weightKg.toFixed(2) };
  return {
    ...data,
    profile,
    plannedSession: data.activeSession ? data.plannedSession : null,
    bodyweights: [...data.bodyweights.filter((w) => w.date !== date), weighIn],
  };
}

/** Saves the split and switches to it, unless a workout is in progress; then it waits in the list. */
export function commitPlan(data: AppData, split: CustomSplit, now: string): { data: AppData; activated: boolean } {
  const saved = saveCustomSplit(data, split, now);
  if (saved.activeSession) return { data: saved, activated: false };
  return { data: setSplit(saved, split.id), activated: true };
}

export function skipOnboarding(data: AppData, now: string): AppData {
  return { ...data, profile: { ...data.profile, onboardedAt: now } };
}
