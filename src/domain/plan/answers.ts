import dayjs from 'dayjs';
import { localDate } from '../stats';
import { saveCustomSplit, setSplit, type CustomSplit } from '../training';
import type { Activity, AppData, BodyGoal, EquipmentKind, FocusArea, Objective, Profile } from '../types';

/** The goal question. Named PlanGoal because `Goal` is the dated-goal type. */
export type PlanGoal = 'lose' | 'build' | 'strength' | 'fit';

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
}

const OBJECTIVE: Record<PlanGoal, Objective> = { lose: 'hypertrophy', build: 'hypertrophy', strength: 'strength', fit: 'general' };
const BODY_GOAL: Record<PlanGoal, BodyGoal> = { lose: 'lose', build: 'gain', strength: 'maintain', fit: 'maintain' };

/** Back from a profile, for prefilling a rerun. */
export function goalFromProfile(p: Profile): PlanGoal | undefined {
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
    bodyGoal: BODY_GOAL[a.goal],
    experience: a.experience,
    daysPerWeek: a.daysPerWeek,
    sessionMinutes: a.sessionMinutes,
    equipment: a.equipment,
    focus: a.focus,
    onboardedAt: now,
  };
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
