import { beforeEach, describe, expect, it } from 'vitest';
import { LAST_STEP, useOnboarding } from './onboarding';

const s = () => useOnboarding.getState();

describe('onboarding draft', () => {
  beforeEach(() => s().reset());

  it('steps forward and back within bounds', () => {
    s().back();
    expect(s().step).toBe(0);
    for (let i = 0; i < 20; i++) s().next();
    expect(s().step).toBe(LAST_STEP);
    expect(LAST_STEP).toBe(9);
    s().back();
    expect(s().step).toBe(8);
  });

  it('merges answers and clears them on reset', () => {
    s().set({ heightCm: 180 });
    s().set({ weightKg: 80 });
    expect(s().answers).toMatchObject({ heightCm: 180, weightKg: 80 });
    s().setTemplate('ppl-abs');
    s().next();
    s().reset();
    expect(s()).toMatchObject({ step: 0, answers: {}, template: null });
  });

  it('starts at a step with prefilled answers', () => {
    s().start({ heightCm: 170 }, 1);
    expect(s()).toMatchObject({ step: 1, answers: { heightCm: 170 } });
  });
});
