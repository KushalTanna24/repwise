import { bmi } from '../stats';
import type { Activity, BodyGoal, Profile } from '../types';

export type BmiBand = 'under' | 'healthy' | 'over' | 'obese';

export function bmiBand(value: number): BmiBand {
  if (value < 18.5) return 'under';
  if (value < 25) return 'healthy';
  if (value < 30) return 'over';
  return 'obese';
}

/** A hint for the goal step only; BMI misreads muscular people, so the user always decides. */
export function suggestedGoal(band: BmiBand): 'lose' | 'build' | null {
  if (band === 'over' || band === 'obese') return 'lose';
  if (band === 'under') return 'build';
  return null;
}

/** Mifflin-St Jeor (1990). */
export function bmr(sex: 'male' | 'female', kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

const ACTIVITY_BASE: Record<Activity, number> = { sitting: 1.2, feet: 1.375, physical: 1.55 };

/** Daily life sets the base; three or more training days add one step. */
export function activityFactor(activity: Activity, daysPerWeek: number): number {
  const base = ACTIVITY_BASE[activity];
  return Math.min(1.725, +(base + (daysPerWeek >= 3 ? 0.175 : 0)).toFixed(3));
}

/** 1.6 g/kg (Morton 2018), 2.0 g/kg in a deficit (Helms 2014); BMI over 30 uses the weight at BMI 25. */
export function proteinGrams(kg: number, cm: number, goal: BodyGoal): number {
  const m = cm / 100;
  const value = bmi(kg, cm);
  const ref = value != null && value > 30 ? 25 * m * m : kg;
  return Math.round(ref * (goal === 'lose' ? 2.0 : 1.6));
}

export interface Energy {
  tdee: number;
  target: number;
  proteinG: number;
  intake?: { kcal: number; delta: number; label: 'below' | 'about' | 'above' };
  note?: string;
}

const round50 = (n: number) => Math.round(n / 50) * 50;
const FLOOR = { male: 1500, female: 1200 } as const;
const MULTIPLIER: Record<BodyGoal, number> = { lose: 0.8, maintain: 1, gain: 1.1 };

/**
 * Calories need sex, age and height; protein needs only height. Missing answers
 * fall back to sitting and maintenance.
 */
export function energy(p: Profile, kg: number, nowYear: number): { proteinG: number; energy: Energy | null } {
  const goal = p.bodyGoal ?? 'maintain';
  const cm = p.heightCm;
  if (!cm || !(kg > 0)) return { proteinG: 0, energy: null };
  const proteinG = proteinGrams(kg, cm, goal);
  if (!p.sex || !p.birthYear) return { proteinG, energy: null };

  const age = nowYear - p.birthYear;
  const tdee = Math.round(bmr(p.sex, kg, cm, age) * activityFactor(p.activity ?? 'sitting', p.daysPerWeek));
  let multiplier = MULTIPLIER[goal];
  let note: string | undefined;
  if (goal === 'lose' && age < 18) {
    multiplier = 1;
    note = 'Under 18: eat to maintain and let training do the work.';
  } else if (goal === 'lose' && (bmi(kg, cm) ?? 20) < 18.5) {
    multiplier = 1;
    note = 'Your BMI is low, so the target stays at maintenance.';
  }
  const target = Math.max(FLOOR[p.sex], round50(tdee * multiplier));

  const out: Energy = { tdee, target, proteinG, ...(note ? { note } : {}) };
  if (p.intakeKcal) {
    const delta = p.intakeKcal - tdee;
    const label = Math.abs(delta) <= tdee * 0.1 ? 'about' : delta < 0 ? 'below' : 'above';
    out.intake = { kcal: p.intakeKcal, delta, label };
  }
  return { proteinG, energy: out };
}

const kcal = (n: number) => n.toLocaleString('en-US');

/**
 * One line on the intake the user typed. It only says "fits" near the target, so a
 * guard (under 18, low BMI) or a crash diet is never praised, and it warns below the floor.
 */
export function intakeAdvice(e: Energy, p: Pick<Profile, 'bodyGoal' | 'sex'>): string | null {
  if (!e.intake) return null;
  const { kcal: eaten, label, delta } = e.intake;
  const floor = p.sex ? FLOOR[p.sex] : 1200;
  if (eaten < floor) return `You eat about ${kcal(eaten)} kcal a day, below a safe minimum of ${kcal(floor)} kcal. Eat at least ${kcal(floor)} kcal.`;
  const where = label === 'about' ? 'You eat about what you burn.' : `You eat about ${kcal(Math.abs(delta))} kcal ${label} maintenance.`;
  if (Math.abs(eaten - e.target) <= e.target * 0.1) return `${where} That fits your goal.`;
  const goal = e.note ? 'maintain' : (p.bodyGoal ?? 'maintain');
  const aim = goal === 'lose' ? 'to lose fat and keep your muscle' : goal === 'gain' ? 'to build' : 'to hold your weight';
  return `${where} Aim for about ${kcal(e.target)} kcal ${aim}.`;
}
