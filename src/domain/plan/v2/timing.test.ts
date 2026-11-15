import { describe, expect, it } from 'vitest';
import { emptyAppData, getExercise } from '../../catalogue';
import type { Profile } from '../../types';
import { NOW } from './fixtures';
import { dayBudgetSec, exerciseLimit, slotSeconds } from './timing';

const p = (o: Partial<Profile>) => ({ ...emptyAppData(NOW).profile, objective: 'hypertrophy', experience: 'intermediate', ...o }) as Profile;

describe('timing', () => {
  it('costs a slot as its sets times work plus rest, like the workout estimate', () => {
    expect(slotSeconds(p({}), 'anchor')).toBe(3 * (40 + 150));
    expect(slotSeconds(p({}), 'accessory')).toBe(3 * (40 + 90));
    expect(slotSeconds(p({ sessionMinutes: 60 }), 'accessory', getExercise('bike', [])!)).toBe(15 * 60);
  });

  it('leaves 5 minutes to warm up', () => {
    expect(dayBudgetSec(p({ sessionMinutes: 60 }))).toBe(55 * 60);
  });

  it('fits more exercises into longer sessions, up to 10', () => {
    expect([45, 60, 75, 90].map((m) => exerciseLimit(p({ sessionMinutes: m as Profile['sessionMinutes'] })))).toEqual([5, 7, 9, 10]);
  });
});
