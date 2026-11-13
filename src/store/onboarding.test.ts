import { beforeEach, describe, expect, it } from 'vitest';
import type { PlanResultV2 } from '@/domain/plan';
import { LAST_STEP, STEP, useOnboarding } from './onboarding';

const s = () => useOnboarding.getState();
const fake = (id: string, exhausted = false) => ({ picks: [[id]], exhausted }) as unknown as PlanResultV2;

describe('onboarding draft', () => {
  beforeEach(() => s().reset());

  it('steps forward and back within bounds', () => {
    s().back();
    expect(s().step).toBe(0);
    for (let i = 0; i < 20; i++) s().next();
    expect(s().step).toBe(LAST_STEP);
    expect(LAST_STEP).toBe(11);
    s().back();
    expect(s().step).toBe(STEP.style);
  });

  it('skips the tape step unless the goal is look', () => {
    s().start({ goal: 'build' }, STEP.goal);
    s().next();
    expect(s().step).toBe(STEP.daily);
    s().back();
    expect(s().step).toBe(STEP.goal);
    s().start({ goal: 'look' }, STEP.goal);
    s().next();
    expect(s().step).toBe(STEP.tape);
    s().next();
    expect(s().step).toBe(STEP.daily);
    s().back();
    expect(s().step).toBe(STEP.tape);
  });

  it('merges answers and clears them on reset', () => {
    s().set({ heightCm: 180 });
    s().set({ weightKg: 80 });
    expect(s().answers).toMatchObject({ heightCm: 180, weightKg: 80 });
    s().next();
    s().reset();
    expect(s()).toMatchObject({ step: 0, answers: {}, history: [], shown: [] });
  });

  it('starts at a step with prefilled answers', () => {
    s().start({ heightCm: 170 }, 1);
    expect(s()).toMatchObject({ step: 1, answers: { heightCm: 170 } });
  });

  it('regenerate keeps history and back pops it', () => {
    s().regenerated(fake('a'), [[['first']]]);
    s().regenerated(fake('b'), s().shown);
    expect(s().history.map((r) => r.picks[0][0])).toEqual(['a', 'b']);
    expect(s().shown).toEqual([[['first']], [['a']], [['b']]]);
    s().backPlan();
    expect(s().history.map((r) => r.picks[0][0])).toEqual(['a']);
  });

  it('an exhausted regenerate starts the cycle again', () => {
    s().regenerated(fake('a'), [[['first']]]);
    s().regenerated(fake('first', true), s().shown);
    expect(s().shown).toEqual([[['first']]]);
  });

  it('changing an answer drops generated plans', () => {
    s().regenerated(fake('a'), [[['first']]]);
    s().set({ style: 'pairs' });
    expect(s()).toMatchObject({ history: [], shown: [] });
  });
});
