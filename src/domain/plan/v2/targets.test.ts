import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../../catalogue';
import type { Profile } from '../../types';
import { NOW, hist } from './fixtures';
import { FLOOR, evidenceTargets, weeklyTargets } from './targets';

const p = (o: Partial<Profile>) => ({ ...emptyAppData(NOW).profile, daysPerWeek: 5, sessionMinutes: 90, ...o }) as Profile;

describe('evidenceTargets', () => {
  it('evidence defaults by experience', () => {
    const t = evidenceTargets(p({ experience: 'intermediate', focus: [] }));
    expect(t.chest).toBe(12);
    expect(t.biceps).toBe(8);
    expect(t['front-delts']).toBe(0);
    expect(t.neck).toBe(0);
    expect(t.forearms).toBe(0);
    expect(evidenceTargets(p({ experience: 'beginner' })).quads).toBe(9);
    expect(evidenceTargets(p({ experience: 'advanced' })).calves).toBe(10);
  });

  it('focus gets +40%, +15% on a cut, capped', () => {
    expect(evidenceTargets(p({ experience: 'intermediate', focus: ['side-delts'] }))['side-delts']).toBe(11);
    expect(evidenceTargets(p({ experience: 'intermediate', focus: ['side-delts'], bodyGoal: 'lose' }))['side-delts']).toBe(9);
    expect(evidenceTargets(p({ experience: 'advanced', focus: ['chest'] })).chest).toBe(20);
    expect(evidenceTargets(p({ experience: 'beginner', focus: ['chest'] })).chest).toBe(13);
  });

  it('focus on traps & neck switches neck on', () => {
    expect(evidenceTargets(p({ experience: 'intermediate', focus: ['traps-neck'] })).neck).toBe(11);
  });

  it('look goal floors delts and turns on neck and forearms for men', () => {
    const t = evidenceTargets(p({ experience: 'beginner', planGoal: 'look', sex: 'male', focus: [] }));
    expect(t['side-delts']).toBe(8);
    expect(t['rear-delts']).toBe(8);
    expect(t.neck).toBe(5);
    expect(t.forearms).toBe(4);
    expect(evidenceTargets(p({ experience: 'beginner', planGoal: 'look', sex: 'female', focus: [] })).neck).toBe(0);
  });
});

describe('weeklyTargets', () => {
  it('trims non-focus groups first to fit the time budget', () => {
    const t = weeklyTargets(p({ experience: 'intermediate', focus: ['chest'] }), null);
    expect(t.budget).toBe(5 * 8 * 3);
    expect(Object.values(t.sets).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(t.budget);
    expect(t.sets.chest).toBe(17);
    expect(t.sets['upper-chest']).toBe(11);
  });

  it('stops at the floor and the focus base when time is very short', () => {
    const t = weeklyTargets(p({ experience: 'intermediate', daysPerWeek: 3, sessionMinutes: 45, focus: ['chest'] }), null);
    expect(t.budget).toBe(3 * 5 * 3);
    expect(t.sets.chest).toBe(12);
    expect(t.sets['upper-chest']).toBe(8);
    expect(t.sets.quads).toBe(FLOOR);
    expect(t.sets.calves).toBe(FLOOR);
  });

  it('never ramps more than +20% or +4 above real baseline', () => {
    expect(weeklyTargets(p({ experience: 'advanced' }), hist({ baseline: { chest: 6 } })).sets.chest).toBe(7);
    expect(weeklyTargets(p({ experience: 'advanced' }), hist({ baseline: { chest: 0 } })).sets.chest).toBe(FLOOR);
  });

  it('keeps a baseline above the evidence number, up to the cap', () => {
    expect(weeklyTargets(p({ experience: 'intermediate' }), hist({ baseline: { lats: 16 } })).sets.lats).toBe(16);
    expect(weeklyTargets(p({ experience: 'intermediate' }), hist({ baseline: { lats: 26 } })).sets.lats).toBe(20);
  });

  it('adds 2 sets to a stalled group when attendance is good, even after an early rise', () => {
    const t = weeklyTargets(
      p({ experience: 'intermediate' }),
      hist({ baseline: { 'side-delts': 8 }, trend: { 'side-delts': { change: 0.2, flatWeeks: 3, lift: 'db-lateral-raise' } }, adherence: 0.8 }),
    );
    expect(t.sets['side-delts']).toBe(10);
    const r = t.reasons.find((x) => x.group === 'side-delts');
    expect(r?.delta).toBe(2);
    expect(r?.text).toBe('Side delts 10 sets (+2): dumbbell lateral raise flat 3 weeks.');
  });

  it('does not add sets when attendance is low', () => {
    const t = weeklyTargets(p({ experience: 'intermediate' }), hist({ baseline: { 'side-delts': 8 }, trend: { 'side-delts': { change: 0, flatWeeks: 5, lift: 'db-lateral-raise' } }, adherence: 0.5 }));
    expect(t.sets['side-delts']).toBe(8);
  });

  it('pulls back 2 sets above evidence when a lift drops', () => {
    const t = weeklyTargets(p({ experience: 'intermediate' }), hist({ baseline: { lats: 16 }, trend: { lats: { change: -0.05, flatWeeks: 4, lift: 'lat-pulldown' } }, adherence: 0.9 }));
    expect(t.sets.lats).toBe(14);
  });

  it('drops one exercise when sessions are usually unfinished', () => {
    const t = weeklyTargets(p({ sessionMinutes: 60 }), hist({ finishRate: 0.7 }));
    expect(t.exerciseLimit).toBe(5);
    expect(t.reasons.some((r) => r.text === 'Days have 1 fewer exercise: you usually finish about 70% of them.')).toBe(true);
    expect(weeklyTargets(p({ sessionMinutes: 60 }), null).exerciseLimit).toBe(6);
  });
});
