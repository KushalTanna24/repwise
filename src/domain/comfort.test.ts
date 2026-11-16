import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { rateSession, splitComfort } from './comfort';
import type { AppData, ComfortScore, WorkoutSession } from './types';

const T0 = '2026-10-17T08:00:00.000Z';

function session(id: string, splitId: string | null, sessionIndex: number | null, day: number, score?: ComfortScore): WorkoutSession {
  const startedAt = new Date(Date.parse(T0) + day * 86_400_000).toISOString();
  return {
    id,
    planKey: null,
    splitId: splitId as WorkoutSession['splitId'],
    sessionIndex,
    cycle: 1,
    title: 'W',
    startedAt,
    finishedAt: startedAt,
    exercises: [],
    ...(score ? { comfort: { score } } : {}),
  };
}

const withSessions = (sessions: WorkoutSession[]): AppData => ({ ...emptyAppData(T0), sessions });

describe('rateSession', () => {
  it('records a score and an optional note on a finished workout', () => {
    const d = rateSession(withSessions([session('a', 'ppl', 0, 0)]), 'a', 4, '  Rows before pulldowns felt better ');
    expect(d.sessions[0].comfort).toEqual({ score: 4, note: 'Rows before pulldowns felt better' });
  });

  it('keeps the note when only the score changes, and clears with null', () => {
    let d = rateSession(withSessions([session('a', 'ppl', 0, 0)]), 'a', 2, 'Too much pressing in a row');
    d = rateSession(d, 'a', 3);
    expect(d.sessions[0].comfort).toEqual({ score: 3, note: 'Too much pressing in a row' });
    d = rateSession(d, 'a', null);
    expect(d.sessions[0].comfort).toBeUndefined();
  });

  it('returns the same object when nothing changes', () => {
    const d = rateSession(withSessions([session('a', 'ppl', 0, 0)]), 'a', 4, 'Good');
    expect(rateSession(d, 'a', 4, ' Good ')).toBe(d);
    expect(rateSession(d, 'a', 4)).toBe(d);
    const blank = withSessions([session('b', 'ppl', 0, 0)]);
    expect(rateSession(blank, 'b', null)).toBe(blank);
  });

  it('ignores unknown workouts', () => {
    const d = withSessions([session('a', 'ppl', 0, 0)]);
    expect(rateSession(d, 'nope', 3)).toBe(d);
  });
});

describe('splitComfort', () => {
  it('is null with no ratings', () => {
    expect(splitComfort(withSessions([session('a', 'ppl', 0, 0)]), 'ppl')).toBeNull();
  });

  it('averages ratings per day and overall for one split only', () => {
    const d = withSessions([
      session('a', 'ppl', 0, 0, 4),
      session('b', 'ppl', 1, 1, 2),
      session('c', 'ppl', 0, 2, 5),
      session('d', 'upper-lower', 0, 3, 1),
      session('e', 'ppl', 2, 4),
    ]);
    const c = splitComfort(d, 'ppl')!;
    expect(c.count).toBe(3);
    expect(c.avg).toBeCloseTo(11 / 3);
    expect(c.days).toEqual({ 0: { avg: 4.5, count: 2 }, 1: { avg: 2, count: 1 } });
  });

  it('uses only the five most recent ratings of each day', () => {
    const scores: ComfortScore[] = [1, 1, 5, 5, 5, 5, 5];
    const c = splitComfort(withSessions(scores.map((s, i) => session(`s${i}`, 'ppl', 0, i, s))), 'ppl')!;
    expect(c.days[0]).toEqual({ avg: 5, count: 5 });
  });

  it('starts fresh for a custom split after it was edited', () => {
    const edited = new Date(Date.parse(T0) + 1.5 * 86_400_000).toISOString();
    const d: AppData = {
      ...withSessions([session('a', 'custom-x', 0, 0, 1), session('b', 'custom-x', 0, 2, 5)]),
      customSplits: [{ id: 'custom-x', custom: true, name: 'Mine', blurb: '', sessions: [], createdAt: T0, updatedAt: edited }],
    };
    expect(splitComfort(d, 'custom-x')).toEqual({ avg: 5, count: 1, days: { 0: { avg: 5, count: 1 } } });
  });
});
