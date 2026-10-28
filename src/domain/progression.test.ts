import { describe, expect, it } from 'vitest';
import { daysOff, easedSets, recommend, returnTier } from './progression';
import type { Exercise, SetRecord, WorkoutSession } from './types';

const bench: Exercise = { id: 'bench-press', name: 'Bench press', muscle: 'Chest', pattern: 'hpush', equipment: 'barbell', kind: 'weighted' };
const dbPress: Exercise = { ...bench, id: 'incline-db-press', equipment: 'dumbbell' };
const pullup: Exercise = { id: 'pull-up', name: 'Pull-up', muscle: 'Back', pattern: 'vpull', equipment: 'bodyweight', kind: 'bodyweight' };
const plank: Exercise = { id: 'plank', name: 'Plank', muscle: 'Core', pattern: 'core', equipment: 'bodyweight', kind: 'timed' };
const rx = { sets: 3, repMin: 8, repMax: 12 };

type Row = [kg: number | null, reps: number | null, status?: SetRecord['status'], assistKg?: number];

let n = 0;
function sess(exerciseId: string, date: string, rows: Row[], finished = true): WorkoutSession {
  return {
    id: `s${n++}`,
    planKey: null,
    splitId: null,
    sessionIndex: null,
    cycle: null,
    title: 'T',
    startedAt: `${date}T10:00:00.000Z`,
    finishedAt: finished ? `${date}T11:00:00.000Z` : null,
    exercises: [
      {
        exerciseId,
        slotId: null,
        plan: null,
        rec: null,
        sets: rows.map(([kg, reps, status = 'done', assistKg]) => ({
          targetKg: null,
          targetReps: null,
          actualKg: kg,
          actualReps: reps,
          status,
          ...(assistKg !== undefined ? { assistKg } : {}),
        })),
      },
    ],
  };
}

describe('recommend', () => {
  it('first time: no load, bottom of range', () => {
    const r = recommend(bench, rx, []);
    expect(r.kind).toBe('first');
    expect(r.targetKg).toBeNull();
    expect(r.targetReps).toEqual([8, 8, 8]);
    expect(r.reason).toContain('First time');
  });

  it('below the top: keep load, beat each set by one rep', () => {
    const r = recommend(bench, rx, [sess('bench-press', '2026-10-01', [[20, 10], [20, 9], [20, 8]])]);
    expect(r.kind).toBe('reps');
    expect(r.targetKg).toBe(20);
    expect(r.targetReps).toEqual([11, 10, 9]);
    expect(r.reason).toBe('Keeping 20 kg. Beat 10 · 9 · 8.');
  });

  it('all sets at top of range: add one barbell increment, reset reps', () => {
    const r = recommend(bench, rx, [sess('bench-press', '2026-10-01', [[20, 12], [20, 12], [20, 12]])]);
    expect(r.kind).toBe('increase');
    expect(r.targetKg).toBe(22.5);
    expect(r.targetReps).toEqual([8, 8, 8]);
    expect(r.reason).toBe('All sets hit 12 at 20 kg. Up to 22.5 kg, aim for 8.');
  });

  it('dumbbells go up 2 kg', () => {
    const r = recommend(dbPress, rx, [sess('incline-db-press', '2026-10-01', [[20, 12], [20, 12], [20, 12]])]);
    expect(r.targetKg).toBe(22);
  });

  it('skipped set means hold', () => {
    const r = recommend(bench, rx, [sess('bench-press', '2026-10-01', [[20, 12], [20, 12], [null, null, 'skipped']])]);
    expect(r.kind).toBe('hold');
    expect(r.targetKg).toBe(20);
    expect(r.reason).toContain('only 2 of 3');
  });

  it('one bad session holds', () => {
    const r = recommend(bench, rx, [sess('bench-press', '2026-10-01', [[25, 9], [25, 8], [25, 6]])]);
    expect(r.kind).toBe('hold');
    expect(r.targetKg).toBe(25);
    expect(r.reason).toBe('One off day. Same target.');
  });

  it('two bad sessions in a row at the same load deload one increment', () => {
    const r = recommend(bench, rx, [
      sess('bench-press', '2026-10-01', [[25, 9], [25, 8], [25, 6]]),
      sess('bench-press', '2026-10-04', [[25, 8], [25, 7], [25, 6]]),
    ]);
    expect(r.kind).toBe('deload');
    expect(r.targetKg).toBe(22.5);
    expect(r.reason).toBe('Two tough sessions at 25 kg. Drop to 22.5 kg, rebuild.');
  });

  it('uses the most recent finished session and ignores unfinished ones and pending sets', () => {
    const r = recommend(bench, rx, [
      sess('bench-press', '2026-10-01', [[20, 10], [20, 9], [20, 8]]),
      sess('bench-press', '2026-10-04', [[30, 12], [30, 12], [30, 12]], false),
    ]);
    expect(r.targetKg).toBe(20);
    const pending = recommend(bench, rx, [sess('bench-press', '2026-10-01', [[20, 12], [20, 12], [20, 12, 'pending']])]);
    expect(pending.kind).toBe('hold');
  });

  it('the 10/9/8 then 12/12/12 brief example', () => {
    const h = [sess('bench-press', '2026-10-01', [[20, 10], [20, 9], [20, 8]])];
    expect(recommend(bench, rx, h).targetKg).toBe(20);
    h.push(sess('bench-press', '2026-10-04', [[20, 12], [20, 12], [20, 12]]));
    expect(recommend(bench, rx, h)).toMatchObject({ kind: 'increase', targetKg: 22.5 });
  });

  it('bodyweight at top of range suggests added load', () => {
    const r = recommend(pullup, { sets: 3, repMin: 6, repMax: 10 }, [sess('pull-up', '2026-10-01', [[0, 10], [0, 10], [0, 10]])]);
    expect(r.kind).toBe('increase');
    expect(r.addedKg).toBe(2.5);
    expect(r.reason).toContain('+2.5 kg');
  });

  it('assisted bodyweight at top of range reduces assistance', () => {
    const r = recommend(pullup, { sets: 3, repMin: 6, repMax: 10 }, [
      sess('pull-up', '2026-10-01', [[0, 10, 'done', 20], [0, 10, 'done', 20], [0, 10, 'done', 20]]),
    ]);
    expect(r.kind).toBe('assist');
    expect(r.assistKg).toBe(15);
    expect(r.reason).toContain('15 kg');
  });

  it('timed holds add five seconds', () => {
    const r = recommend(plank, { sets: 3, repMin: 30, repMax: 60 }, [sess('plank', '2026-10-01', [[null, 60], [null, 60], [null, 60]])]);
    expect(r.targetReps).toEqual([65, 65, 65]);
  });
});

describe('return after a gap', () => {
  const top = (date: string) => sess('bench-press', date, [[100, 12], [100, 12], [100, 12]]);
  const at = (date: string) => `${date}T09:00:00.000Z`;

  it('daysOff counts whole days since the last finished session', () => {
    expect(daysOff([], at('2026-10-20'))).toBeNull();
    expect(daysOff([top('2026-10-01'), sess('bench-press', '2026-10-10', [[100, 8]], false)], at('2026-10-20'))).toBe(19);
  });

  it('tiers switch at 10, 21 and 43 days', () => {
    expect([null, 0, 9, 10, 20, 21, 42, 43, 200].map(returnTier)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('without a date, or under 10 days off, progression is unchanged', () => {
    expect(recommend(bench, rx, [top('2026-10-01')]).kind).toBe('increase');
    expect(recommend(bench, rx, [top('2026-10-01')], at('2026-10-10')).kind).toBe('increase');
  });

  it('10 to 20 days off: same load as last time, no increase', () => {
    const r = recommend(bench, rx, [top('2026-10-01')], at('2026-10-15'));
    expect(r.kind).toBe('hold');
    expect(r.targetKg).toBe(100);
    expect(r.targetReps).toEqual([8, 8, 8]);
    expect(r.reason).toBe('Back after 14 days. Same 100 kg as last time, no jump yet.');
  });

  it('21 to 42 days off: load eased 15%, rounded to the plate step', () => {
    const r = recommend(bench, rx, [top('2026-10-01')], at('2026-10-25'));
    expect(r.kind).toBe('deload');
    expect(r.targetKg).toBe(85);
    expect(r.reason).toBe('Back after 24 days. Eased 15% to 85 kg.');
  });

  it('43+ days off: load eased 30%', () => {
    expect(recommend(bench, rx, [top('2026-08-01')], at('2026-10-25')).targetKg).toBe(70);
  });

  it('timed holds restart at the bottom of the range', () => {
    const r = recommend(plank, { sets: 3, repMin: 30, repMax: 60 }, [sess('plank', '2026-10-01', [[null, 60], [null, 60], [null, 60]])], at('2026-10-25'));
    expect(r.targetKg).toBeNull();
    expect(r.targetReps).toEqual([30, 30, 30]);
  });

  it('assisted moves get more assistance', () => {
    const r = recommend(pullup, rx, [sess('pull-up', '2026-10-01', [[0, 12, 'done', 20], [0, 12, 'done', 20], [0, 12, 'done', 20]])], at('2026-10-25'));
    expect(r.assistKg).toBe(25);
  });

  it('a session done with one set fewer by plan is not read as missed sets', () => {
    const last = sess('bench-press', '2026-10-01', [[85, 10], [85, 10]]);
    last.exercises[0].plan = { sets: 2, repMin: 8, repMax: 12, restSec: 150 };
    expect(recommend(bench, rx, [last], at('2026-10-03')).kind).toBe('reps');
  });

  it('easedSets drops one set from 21 days off, never below 2', () => {
    expect([easedSets(3, 1), easedSets(3, 2), easedSets(4, 3), easedSets(2, 2)]).toEqual([3, 2, 3, 2]);
  });
});
