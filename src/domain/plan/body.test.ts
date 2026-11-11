import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { Profile } from '../types';
import { activityFactor, bmiBand, bmr, energy, intakeAdvice, proteinGrams, suggestedGoal } from './body';

const YEAR = 2026;
const round50 = (n: number) => Math.round(n / 50) * 50;

function profile(over: Partial<Profile>): Profile {
  return { ...emptyAppData('2026-11-11T08:00:00.000Z').profile, ...over };
}

const man = profile({ sex: 'male', birthYear: 1996, heightCm: 180, activity: 'sitting', daysPerWeek: 4, bodyGoal: 'lose' });

describe('intakeAdvice', () => {
  const at = (p: Profile, kg = 80) => energy(p, kg, YEAR).energy!;

  it('never says a teen eating below maintenance fits their goal', () => {
    const teen = { ...man, birthYear: 2010, intakeKcal: 1900 };
    const line = intakeAdvice(at(teen), teen)!;
    expect(line).not.toMatch(/fits/);
    expect(line).toContain(at(teen).target.toLocaleString());
  });

  it('warns below the safe minimum', () => {
    const p = { ...man, intakeKcal: 1000 };
    expect(intakeAdvice(at(p), p)).toBe('You eat about 1,000 kcal a day, below a safe minimum of 1,500 kcal. Eat at least 1,500 kcal.');
  });

  it('says a cut fits only near the target', () => {
    const near = { ...man, intakeKcal: at(man).target };
    expect(intakeAdvice(at(near), near)).toMatch(/That fits your goal\.$/);
    const deep = { ...man, intakeKcal: 1600 };
    const line = intakeAdvice(at(deep), deep)!;
    expect(line).not.toMatch(/fits/);
    expect(line).toContain(`Aim for about ${at(man).target.toLocaleString()} kcal`);
  });

  it('says a gain fits near its target', () => {
    const p = { ...man, bodyGoal: 'gain' as const };
    const q = { ...p, intakeKcal: at(p).target };
    expect(intakeAdvice(at(q), q)).toMatch(/That fits your goal\.$/);
  });

  it('is null without an intake', () => expect(intakeAdvice(at(man), man)).toBeNull());
});

describe('bmr (Mifflin-St Jeor)', () => {
  it('matches known values', () => {
    expect(bmr('male', 80, 180, 30)).toBe(1780);
    expect(bmr('female', 60, 165, 30)).toBe(1320.25);
  });
});

describe('activityFactor', () => {
  it('steps up once for 3+ training days and caps at 1.725', () => {
    expect(activityFactor('sitting', 2)).toBe(1.2);
    expect(activityFactor('sitting', 3)).toBe(1.375);
    expect(activityFactor('feet', 4)).toBe(1.55);
    expect(activityFactor('physical', 6)).toBe(1.725);
  });
});

describe('bmiBand and suggestedGoal', () => {
  it('uses 18.5, 25 and 30 with the lower bound inclusive', () => {
    expect([18.4, 18.5, 24.9, 25, 29.9, 30].map(bmiBand)).toEqual(['under', 'healthy', 'healthy', 'over', 'over', 'obese']);
  });
  it('suggests lose above 25, build under 18.5, nothing in between', () => {
    expect(suggestedGoal('over')).toBe('lose');
    expect(suggestedGoal('obese')).toBe('lose');
    expect(suggestedGoal('under')).toBe('build');
    expect(suggestedGoal('healthy')).toBeNull();
  });
});

describe('energy', () => {
  it('cuts 20% for lose and uses 2.0 g/kg protein', () => {
    const { energy: e, proteinG } = energy(man, 80, YEAR);
    const tdee = Math.round(1780 * 1.375);
    expect(e!.tdee).toBe(tdee);
    expect(e!.target).toBe(round50(tdee * 0.8));
    expect(proteinG).toBe(160);
    expect(e!.proteinG).toBe(160);
  });

  it('adds 10% for gain and holds maintenance otherwise', () => {
    const tdee = Math.round(1780 * 1.375);
    expect(energy({ ...man, bodyGoal: 'gain' }, 80, YEAR).energy!.target).toBe(round50(tdee * 1.1));
    expect(energy({ ...man, bodyGoal: 'maintain' }, 80, YEAR).energy!.target).toBe(round50(tdee));
  });

  it('never goes below 1200 kcal for women or 1500 kcal for men', () => {
    const small = profile({ sex: 'female', birthYear: 1966, heightCm: 150, activity: 'sitting', daysPerWeek: 2, bodyGoal: 'lose' });
    expect(energy(small, 45, YEAR).energy!.target).toBe(1200);
    expect(energy({ ...small, sex: 'male' }, 45, YEAR).energy!.target).toBe(1500);
  });

  it('suggests no deficit under 18', () => {
    const teen = { ...man, birthYear: 2010 };
    const e = energy(teen, 80, YEAR).energy!;
    expect(e.target).toBe(round50(e.tdee));
    expect(e.note).toBe('Under 18: eat to maintain and let training do the work.');
  });

  it('suggests no deficit when BMI is under 18.5', () => {
    const e = energy(man, 56.7, YEAR).energy!; // 56.7 / 1.8² = 17.5
    expect(e.target).toBe(round50(e.tdee));
    expect(e.note).toBe('Your BMI is low, so the target stays at maintenance.');
  });

  it('uses the BMI 25 weight for protein when BMI is over 30', () => {
    expect(proteinGrams(120, 170, 'maintain')).toBe(Math.round(25 * 1.7 * 1.7 * 1.6));
    expect(proteinGrams(80, 180, 'maintain')).toBe(128);
  });

  it('hides calories but keeps protein when sex or age is missing', () => {
    for (const p of [{ ...man, sex: undefined }, { ...man, birthYear: undefined }]) {
      const r = energy(p, 80, YEAR);
      expect(r.energy).toBeNull();
      expect(r.proteinG).toBe(160);
    }
  });

  it('compares typed intake with maintenance', () => {
    expect(energy({ ...man, intakeKcal: 2000 }, 80, YEAR).energy!.intake).toEqual({ kcal: 2000, delta: -448, label: 'below' });
    expect(energy({ ...man, intakeKcal: 2500 }, 80, YEAR).energy!.intake!.label).toBe('about');
    expect(energy({ ...man, intakeKcal: 3000 }, 80, YEAR).energy!.intake!.label).toBe('above');
    expect(energy(man, 80, YEAR).energy!.intake).toBeUndefined();
  });

  it('defaults to sitting and maintenance when those answers are missing', () => {
    const e = energy({ ...man, activity: undefined, bodyGoal: undefined }, 80, YEAR).energy!;
    expect(e.tdee).toBe(Math.round(1780 * 1.375));
    expect(e.target).toBe(round50(e.tdee));
  });
});
