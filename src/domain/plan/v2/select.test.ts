import { describe, expect, it } from 'vitest';
import { META } from './exerciseMeta';
import { ctxFor, dataWith, hist } from './fixtures';
import { buildCandidate, limitedGroups } from './select';

describe('buildCandidate', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    const ctx = ctxFor({ daysPerWeek: 4 }, 'upper-lower');
    expect(buildCandidate(ctx, 7).picks).toEqual(buildCandidate(ctx, 7).picks);
    const seeds = [1, 2, 3, 4, 5].map((s) => buildCandidate(ctx, s).picks.flat().join());
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('puts lateral raises in a V-taper plan and reaches the look floor', () => {
    const c = buildCandidate(ctxFor({ planGoal: 'look', sex: 'male', focus: ['side-delts', 'lats', 'upper-chest'], daysPerWeek: 4 }, 'upper-lower'), 1);
    expect(c.picks.flat().some((id) => id.includes('lateral-raise'))).toBe(true);
    expect(c.achieved['side-delts']).toBeGreaterThanOrEqual(8);
  });

  it('opens a major group with a compound and caps high-fatigue moves', () => {
    const ctx = ctxFor({ daysPerWeek: 3, experience: 'advanced' }, 'full');
    const c = buildCandidate(ctx, 3);
    for (const day of c.picks) expect(day.filter((id) => META[id]?.fatigue === 'high').length).toBeLessThanOrEqual(2);
    for (const s of c.sessions) {
      const first = s.slots[0];
      expect(META[first.candidates[0]].compound).toBe(true);
      expect(first.role).toBe('anchor');
    }
  });

  it('never repeats an exercise or a compound pattern within a day', () => {
    const c = buildCandidate(ctxFor({ daysPerWeek: 3, sessionMinutes: 90 }, 'full'), 5);
    for (const day of c.picks) {
      expect(new Set(day).size).toBe(day.length);
      const compoundPatterns = c.sessions[c.picks.indexOf(day)].slots.filter((s) => META[s.candidates[0]].compound).map((s) => s.pattern);
      expect(new Set(compoundPatterns).size).toBe(compoundPatterns.length);
    }
  });

  it('keeps high-skill lifts out of beginner plans', () => {
    const c = buildCandidate(ctxFor({ daysPerWeek: 3, experience: 'beginner' }, 'full'), 2);
    for (const id of c.picks.flat()) expect(META[id].skill, id).toBe('low');
  });

  it('fills a cardio day with abs then one timed block', () => {
    const c = buildCandidate(ctxFor({ daysPerWeek: 4 }, 'pairs'), 1);
    const day = c.sessions[3];
    expect(day.slots.at(-1)!.pattern).toBe('cardio');
    expect(day.slots.filter((s) => s.pattern === 'cardio')).toHaveLength(1);
    expect(day.slots.some((s) => s.pattern === 'core')).toBe(true);
  });

  it('never exceeds the exercise limit on lifting slots', () => {
    const ctx = ctxFor({ daysPerWeek: 4, sessionMinutes: 45 }, 'upper-lower');
    for (const s of buildCandidate(ctx, 9).sessions) expect(s.slots.filter((x) => x.pattern !== 'cardio').length).toBeLessThanOrEqual(ctx.targets.exerciseLimit);
  });

  it('prefers liked moves and avoids avoided ones', () => {
    const base = ctxFor({ daysPerWeek: 4 }, 'upper-lower');
    const liked = ctxFor({ daysPerWeek: 4 }, 'upper-lower', hist({ qualifies: false, avoided: new Set(['cable-lateral-raise']), liked: new Set(['db-lateral-raise']) }));
    expect(buildCandidate(base, 1).picks.flat()).toContain('cable-lateral-raise');
    const ids = buildCandidate(liked, 1).picks.flat();
    expect(ids).toContain('db-lateral-raise');
    expect(ids).not.toContain('cable-lateral-raise');
  });

  it('lists alternates with the same pattern and primary groups', () => {
    const c = buildCandidate(ctxFor({ daysPerWeek: 4 }, 'upper-lower'), 1);
    const raise = c.sessions.flatMap((s) => s.slots).find((s) => s.candidates[0].includes('lateral-raise'))!;
    expect(raise.candidates.length).toBeGreaterThan(1);
    for (const id of raise.candidates) expect(META[id].muscles['side-delts']).toBe(1);
  });
});

describe('limitedGroups', () => {
  it('flags groups no eligible exercise trains directly', () => {
    expect(limitedGroups(dataWith([], { equipment: ['bodyweight'] }))).toContain('side-delts');
    expect(limitedGroups(dataWith([]))).toEqual([]);
  });
});
