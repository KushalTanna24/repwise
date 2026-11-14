import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { Profile } from '../types';
import {
  activityFactor,
  bmiBand,
  bmr,
  deurenbergBodyFat,
  energy,
  estimateBodyFat,
  intakeAdvice,
  leannessTarget,
  lookBodyGoal,
  navyBodyFat,
  proteinGrams,
  suggestedGoal,
} from './body';

describe('body fat', () => {
  it('navy formula', () => {
    expect(navyBodyFat('male', 180, 85, 38)).toBeCloseTo(16.1, 1);
    expect(navyBodyFat('female', 165, 70, 32, 95)).toBeCloseTo(24.9, 1);
    expect(navyBodyFat('female', 165, 70, 32)).toBeNull();
    expect(navyBodyFat('male', 180, 30, 38)).toBeNull();
  });

  it('deurenberg fallback', () => {
    expect(deurenbergBodyFat('male', 24, 30)).toBeCloseTo(19.5, 1);
    expect(deurenbergBodyFat('female', 22, 30)).toBeCloseTo(27.9, 1);
  });

  it('estimate prefers tape, falls back to rough, needs sex and height', () => {
    const p = (o: Partial<Profile>) => ({ ...emptyAppData('2026-11-11T08:00:00.000Z').profile, ...o }) as Profile;
    expect(estimateBodyFat(p({ sex: 'male', heightCm: 180 }), 80, 2026, { waistCm: 85, neckCm: 38 })).toEqual({ pct: expect.closeTo(16.1, 1), method: 'navy' });
    expect(estimateBodyFat(p({ sex: 'male', heightCm: 180, birthYear: 1996 }), 77.76, 2026)).toEqual({ pct: expect.closeTo(19.5, 1), method: 'rough' });
    expect(estimateBodyFat(p({ sex: 'male', heightCm: 180 }), 77.76, 2026)?.method).toBe('rough');
    expect(estimateBodyFat(p({ heightCm: 180 }), 80, 2026)).toBeNull();
    expect(estimateBodyFat(p({ sex: 'female' }), 60, 2026)).toBeNull();
  });

  it('leanness targets', () => {
    expect(leannessTarget('male')).toEqual({ min: 10, max: 15, floor: 8 });
    expect(leannessTarget('female')).toEqual({ min: 18, max: 25, floor: 16 });
  });

  it('look goal body goal', () => {
    expect(lookBodyGoal({ pct: 19, method: 'rough' }, 'male')).toBe('lose');
    expect(lookBodyGoal({ pct: 12, method: 'navy' }, 'male')).toBe('maintain');
    expect(lookBodyGoal({ pct: 9, method: 'navy' }, 'male')).toBe('gain');
    expect(lookBodyGoal({ pct: 7, method: 'navy' }, 'male')).toBe('maintain');
    expect(lookBodyGoal({ pct: 27, method: 'navy' }, 'female')).toBe('lose');
    expect(lookBodyGoal(null, undefined)).toBe('maintain');
    expect(lookBodyGoal({ pct: 30, method: 'rough' }, undefined)).toBe('maintain');
  });
});

describe('deficit size', () => {
  it('never exceeds 1% of body weight a week for any adult the cut applies to', () => {
    for (const sex of ['male', 'female'] as const)
      for (let kg = 45; kg <= 160; kg += 5)
        for (let cm = 150; cm <= 205; cm += 5)
          for (const age of [18, 25, 40, 60]) {
            if (kg / (cm / 100) ** 2 < 18.5) continue;
            const p = { ...emptyAppData('2026-11-11T08:00:00.000Z').profile, sex, heightCm: cm, birthYear: 2026 - age, activity: 'physical', daysPerWeek: 6, bodyGoal: 'lose' } as Profile;
            const e = energy(p, kg, 2026).energy!;
            expect(e.tdee - e.target, `${sex} ${kg}kg ${cm}cm ${age}y`).toBeLessThanOrEqual((kg * 0.01 * 7700) / 7 + 25);
          }
  });
});

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
