import { describe, expect, it } from 'vitest';
import { ctxFor } from './fixtures';
import { planDistance, scorePlan } from './score';
import { buildCandidate } from './select';

describe('planDistance', () => {
  it('is Jaccard distance on exercise ids', () => {
    expect(planDistance([['a', 'b']], [['b', 'c']])).toBeCloseTo(2 / 3);
    expect(planDistance([['a']], [['a']])).toBe(0);
    expect(planDistance([['a'], ['b']], [['b', 'a']])).toBe(0);
    expect(planDistance([['a']], [['b']])).toBe(1);
  });
});

describe('scorePlan', () => {
  it('scores a plan that covers its targets above one that skips a day', () => {
    const ctx = ctxFor({ daysPerWeek: 4 }, 'upper-lower');
    const good = buildCandidate(ctx, 1);
    const gutted = { ...good, achieved: { ...good.achieved, chest: 0, lats: 0 }, sessions: good.sessions.map((s, i) => (i === 0 ? { ...s, slots: s.slots.slice(0, 1) } : s)) };
    expect(scorePlan(good, ctx)).toBeGreaterThan(scorePlan(gutted, ctx));
  });

  it('is finite for every seed', () => {
    const ctx = ctxFor({ daysPerWeek: 5 }, 'pairs');
    for (let s = 0; s < 5; s++) expect(Number.isFinite(scorePlan(buildCandidate(ctx, s), ctx))).toBe(true);
  });
});
