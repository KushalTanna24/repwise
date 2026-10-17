import { describe, expect, it } from 'vitest';
import { recommend } from './progression';
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
