import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { AppData, WorkoutSession } from '../types';
import { scoreboard, type MemberInput } from './scoreboard';

// Friday 13 Nov 2026, 13:30 in Asia/Kolkata (vitest TZ). The week starts Monday 9 Nov.
const NOW = '2026-11-13T08:00:00.000Z';
const TODAY = '2026-11-13';

function sess(startedAt: string, kg = 60, reps = 8): WorkoutSession {
  return {
    id: startedAt, planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'T', startedAt, finishedAt: startedAt,
    exercises: [{ exerciseId: 'back-squat', slotId: null, plan: null, rec: null, sets: [{ targetKg: null, targetReps: null, actualKg: kg, actualReps: reps, status: 'done' }] }],
  };
}
function doc(days: number, starts: string[]): AppData {
  const d = emptyAppData(NOW);
  d.profile.daysPerWeek = days;
  d.sessions = starts.map((s) => sess(s));
  return d;
}
const m = (userId: string, d: AppData | null, name = userId): MemberInput => ({ userId, name, doc: d });
const thisWeek = (n: number) =>
  ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-10', '2026-11-11'].slice(0, n).map((x, i) => `${x}T0${i}:30:00.000Z`);

describe('scoreboard', () => {
  it('ranks by consistency, capped at 1', () => {
    const rows = scoreboard([m('lifter', doc(6, thisWeek(3))), m('parent', doc(3, thisWeek(3))), m('kid', doc(3, thisWeek(1)))], NOW, TODAY);
    const by = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(by.parent.consistency).toBe(1);
    expect(by.lifter.consistency).toBe(0.5);
    expect(by.parent.rank).toBe(1);
    expect(by.kid.rank).toBe(3);
    const big = scoreboard([m('a', doc(3, thisWeek(6))), m('b', doc(3, thisWeek(3)))], NOW, TODAY);
    expect(big.find((r) => r.userId === 'a')!.consistency).toBe(1);
    expect(big.every((r) => r.targetHit)).toBe(true);
  });

  it('ties on every key share a rank', () => {
    const rows = scoreboard([m('a', doc(3, thisWeek(2))), m('b', doc(3, thisWeek(2))), m('c', doc(3, []))], NOW, TODAY);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('null doc shows 0 of target and a null improvement', () => {
    const [row] = scoreboard([m('a', null)], NOW, TODAY);
    expect(row).toMatchObject({ done: 0, consistency: 0, streak: 0, improvement: null, rank: 1, targetHit: false });
    expect(Number.isNaN(row.target)).toBe(false);
  });

  it('daysPerWeek 0 does not divide by zero', () => {
    const [row] = scoreboard([m('a', doc(0, thisWeek(1)))], NOW, TODAY);
    expect(row.consistency).toBe(0);
    expect(row.targetHit).toBe(false);
  });

  it("crown goes to last week's rank-1", () => {
    const lastWeek = ['2026-11-02T05:00:00.000Z', '2026-11-03T05:00:00.000Z', '2026-11-04T05:00:00.000Z'];
    const rows = scoreboard([m('a', doc(3, [...lastWeek, ...thisWeek(1)])), m('b', doc(3, thisWeek(3)))], NOW, TODAY);
    expect(rows.find((r) => r.userId === 'a')!.crown).toBe(true);
    expect(rows.find((r) => r.userId === 'b')!.crown).toBe(false);
  });

  it('no crown when nobody trained last week', () => {
    const rows = scoreboard([m('a', doc(3, thisWeek(1)))], NOW, TODAY);
    expect(rows[0].crown).toBe(false);
  });

  it("uses the viewer's week", () => {
    // Sunday 15 Nov 19:00 UTC is Monday 16 Nov 00:30 in Kolkata, so it belongs to the new week.
    const rows = scoreboard([m('a', doc(3, ['2026-11-15T19:00:00.000Z']))], '2026-11-16T02:00:00.000Z', '2026-11-16');
    expect(rows[0].done).toBe(1);
  });

  it('improvement is the strength change once a lift has two sessions', () => {
    const d = emptyAppData(NOW);
    d.sessions = [sess('2026-10-01T05:00:00.000Z', 100, 5), sess('2026-11-10T05:00:00.000Z', 110, 5)];
    const [row] = scoreboard([m('a', d)], NOW, TODAY);
    expect(row.improvement).toBeCloseTo(0.1, 5);
  });
});
