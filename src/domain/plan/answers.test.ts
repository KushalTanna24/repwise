import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { AppData, WorkoutSession } from '../types';
import { applyAnswers, commitPlan, goalFromProfile, lookPreset, skipOnboarding, type PlanAnswers } from './answers';
import { generatePlan } from './generate';
import { needsOnboarding } from './gate';

const NOW = '2026-11-11T08:00:00.000Z';

const answers: PlanAnswers = {
  heightCm: 180,
  weightKg: 80,
  sex: 'male',
  age: 30,
  goal: 'lose',
  activity: 'sitting',
  intakeKcal: 2200,
  experience: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
  equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
  focus: ['chest', 'abs'],
};

describe('look goal answers', () => {
  it('writes planGoal, tape, style and hypertrophy', () => {
    const out = applyAnswers(emptyAppData(NOW), { ...answers, goal: 'look', sex: 'male', waistCm: 85, neckCm: 38, style: 'pairs' }, NOW);
    expect(out.profile).toMatchObject({ planGoal: 'look', objective: 'hypertrophy', waistCm: 85, neckCm: 38, planStyle: 'pairs' });
    expect(goalFromProfile(out.profile)).toBe('look');
  });

  it('cuts when body fat is above the leanness target', () => {
    // 180 cm, waist 95, neck 38: about 22% by the Navy formula, above 15%.
    expect(applyAnswers(emptyAppData(NOW), { ...answers, goal: 'look', sex: 'male', waistCm: 95, neckCm: 38 }, NOW).profile.bodyGoal).toBe('lose');
    // 180 cm, waist 80, neck 38: about 12%, inside 10 to 15%.
    expect(applyAnswers(emptyAppData(NOW), { ...answers, goal: 'look', sex: 'male', waistCm: 80, neckCm: 38 }, NOW).profile.bodyGoal).toBe('maintain');
  });

  it('look goal without sex has no preset and maintains', () => {
    expect(lookPreset(undefined)).toEqual([]);
    expect(applyAnswers(emptyAppData(NOW), { ...answers, goal: 'look', sex: undefined }, NOW).profile.bodyGoal).toBe('maintain');
  });

  it('presets by sex', () => {
    expect(lookPreset('male')).toEqual(['side-delts', 'lats', 'upper-chest']);
    expect(lookPreset('female')).toEqual(['glutes', 'side-delts', 'lats']);
  });

  it('saves custom pairs and records the plan goal for every goal', () => {
    const pairs = [{ title: 'A', groups: ['chest' as const] }, { title: 'B', groups: ['quads' as const] }];
    const out = applyAnswers(emptyAppData(NOW), { ...answers, style: 'custom', customPairs: pairs }, NOW);
    expect(out.profile.customPairs).toEqual(pairs);
    expect(out.profile.planGoal).toBe('lose');
  });
});

describe('applyAnswers', () => {
  it('maps each goal to an objective and a body goal', () => {
    const cases = [
      ['lose', 'hypertrophy', 'lose'],
      ['build', 'hypertrophy', 'gain'],
      ['strength', 'strength', 'maintain'],
      ['fit', 'general', 'maintain'],
    ] as const;
    for (const [goal, objective, bodyGoal] of cases) {
      const p = applyAnswers(emptyAppData(NOW), { ...answers, goal }, NOW).profile;
      expect([p.objective, p.bodyGoal]).toEqual([objective, bodyGoal]);
    }
  });

  it('stores the answers and marks onboarding done', () => {
    const d = applyAnswers(emptyAppData(NOW), answers, NOW);
    expect(d.profile).toMatchObject({
      heightCm: 180,
      sex: 'male',
      birthYear: 1996,
      activity: 'sitting',
      intakeKcal: 2200,
      experience: 'intermediate',
      daysPerWeek: 4,
      sessionMinutes: 60,
      focus: ['chest', 'abs'],
      onboardedAt: NOW,
    });
    expect(needsOnboarding(d)).toBe(false);
  });

  it('leaves skipped answers empty', () => {
    const d = applyAnswers(emptyAppData(NOW), { ...answers, sex: undefined, age: undefined, intakeKcal: undefined }, NOW);
    expect([d.profile.sex, d.profile.birthYear, d.profile.intakeKcal]).toEqual([undefined, undefined, undefined]);
  });

  it('replaces a same-day weigh-in instead of adding a second', () => {
    const base = { ...emptyAppData(NOW), bodyweights: [{ id: 'old', date: '2026-11-11', kg: 82 }, { id: 'prev', date: '2026-11-01', kg: 83 }] };
    const d = applyAnswers(base, answers, NOW);
    expect(d.bodyweights.filter((w) => w.date === '2026-11-11').map((w) => w.kg)).toEqual([80]);
    expect(d.bodyweights).toHaveLength(2);
  });
});

describe('commitPlan', () => {
  const ready = () => applyAnswers(emptyAppData(NOW), answers, NOW);

  it('saves and activates the split', () => {
    const d = ready();
    const { split } = generatePlan(d, 'ul-4', NOW);
    const r = commitPlan(d, split, NOW);
    expect(r.activated).toBe(true);
    expect(r.data.program.splitId).toBe(split.id);
    expect(r.data.customSplits.map((s) => s.id)).toEqual([split.id]);
  });

  it('saves without switching during a workout', () => {
    const active: WorkoutSession = { id: 'a', planKey: null, splitId: 'ppl', sessionIndex: 0, cycle: 1, title: 'Push', startedAt: NOW, finishedAt: null, exercises: [] };
    const d: AppData = { ...ready(), activeSession: active, program: { ...ready().program, splitId: 'ppl' } };
    const { split } = generatePlan(d, 'ul-4', NOW);
    const r = commitPlan(d, split, NOW);
    expect(r.activated).toBe(false);
    expect(r.data.program.splitId).toBe('ppl');
    expect(r.data.customSplits.map((s) => s.id)).toEqual([split.id]);
  });
});

describe('skipOnboarding', () => {
  it('marks onboarding done and nothing else', () => {
    const d = skipOnboarding(emptyAppData(NOW), NOW);
    expect(d.profile.onboardedAt).toBe(NOW);
    expect(d.customSplits).toEqual([]);
    expect(needsOnboarding(d)).toBe(false);
  });
});
