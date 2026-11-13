import { describe, expect, it } from 'vitest';
import { emptyAppData, getExercise } from '../catalogue';
import type { Profile } from '../types';
import { FLOOR, GROUPS, MAJOR, exerciseGroups, focusGroups, setsPerExercise, weeklyBudget, weeklyTargets, type Group } from './volume';

function profile(over: Partial<Profile> = {}): Profile {
  return { ...emptyAppData('2026-11-11T08:00:00.000Z').profile, daysPerWeek: 6, sessionMinutes: 90, ...over };
}
const ex = (id: string) => getExercise(id, [])!;
const sum = (r: Record<Group, number>) => GROUPS.reduce((a, g) => a + r[g], 0);

describe('weeklyTargets', () => {
  it('uses experience bases with minors two lower when the budget is ample', () => {
    const cases = [
      ['beginner', 10, 8],
      ['intermediate', 12, 10],
      ['advanced', 14, 12],
    ] as const;
    for (const [experience, major, minor] of cases) {
      const t = weeklyTargets(profile({ experience }));
      for (const g of GROUPS) expect(t.sets[g]).toBe(MAJOR.has(g) ? major : minor);
    }
  });

  it('raises focus by 1.5×, 1.25× in a deficit, capped at 20 (beginner 14)', () => {
    expect(weeklyTargets(profile({ focus: ['chest'] })).sets.chest).toBe(18);
    expect(weeklyTargets(profile({ focus: ['chest'], bodyGoal: 'lose' })).sets.chest).toBe(15);
    expect(weeklyTargets(profile({ focus: ['chest'], experience: 'advanced' })).sets.chest).toBe(20);
    expect(weeklyTargets(profile({ focus: ['chest'], experience: 'beginner' })).sets.chest).toBe(14);
  });

  it('arms raises both biceps and triceps', () => {
    const t = weeklyTargets(profile({ focus: ['arms'] }));
    expect([t.sets.biceps, t.sets.triceps]).toEqual([15, 15]);
    expect(t.focus).toEqual(new Set(['biceps', 'triceps']));
  });

  it('fits the budget by trimming non-focus groups largest first', () => {
    const t = weeklyTargets(profile({ daysPerWeek: 5, sessionMinutes: 60, focus: ['chest'] }));
    expect(t.budget).toBe(90);
    expect(sum(t.sets)).toBe(90);
    expect(t.sets.chest).toBe(18);
    for (const g of GROUPS) if (g !== 'chest') expect(t.sets[g]).toBe(8);
  });

  it('stops at the floor and the focus base when time is too short', () => {
    const t = weeklyTargets(profile({ daysPerWeek: 3, sessionMinutes: 45, focus: ['chest'] }));
    expect(t.budget).toBe(45);
    expect(t.sets.chest).toBe(12);
    for (const g of GROUPS) if (g !== 'chest') expect(t.sets[g]).toBe(FLOOR);
  });
});

describe('helpers', () => {
  it('counts primary 1 and secondary 0.5 per group', () => {
    expect(exerciseGroups(ex('bench-press'))).toEqual({ chest: 1, shoulders: 0.5, triceps: 0.5 });
    expect(exerciseGroups(ex('romanian-deadlift'))).toEqual({ hamstrings: 1, glutes: 1 });
    expect(exerciseGroups(ex('barbell-row')).back).toBe(1);
  });

  it('maps focus areas to groups', () => {
    expect(focusGroups(['legs', 'abs'])).toEqual(new Set(['quads', 'hamstrings', 'calves', 'abs']));
    expect(focusGroups([])).toEqual(new Set());
  });

  it('sizes the budget from days, session length and sets per exercise', () => {
    expect(setsPerExercise({ objective: 'hypertrophy', experience: 'advanced' })).toBe(4);
    expect(weeklyBudget(profile({ daysPerWeek: 4, sessionMinutes: 60 }))).toBe(4 * 6 * 3);
  });
});
