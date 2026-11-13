import { describe, expect, it } from 'vitest';
import { emptyAppData, getExercise } from '../catalogue';
import type { AppData, SetRecord, WorkoutSession } from '../types';
import { cardioMinutes, prescribe, prescription } from './prescribe';

describe('cardio prescription', () => {
  const p = { objective: 'hypertrophy', experience: 'intermediate' } as const;
  it('cardio is one timed block sized by session length', () => {
    const ex = getExercise('incline-walk', [])!;
    expect(ex.pattern).toBe('cardio');
    expect(prescription(p, 'accessory', ex, 45)).toEqual({ sets: 1, repMin: 600, repMax: 600, restSec: 0 });
    expect(prescription(p, 'accessory', ex)).toEqual({ sets: 1, repMin: 900, repMax: 900, restSec: 0 });
    expect(cardioMinutes(45)).toBe(10);
    expect(cardioMinutes(60)).toBe(15);
    expect(cardioMinutes(75)).toBe(20);
    expect(cardioMinutes(90)).toBe(20);
  });
});

const NOW = '2026-10-06T08:00:00.000Z';
const FIFTEEN_DAYS_AFTER_LAST = '2026-10-20T08:00:00.000Z';

const finished = (id: string, exerciseId: string, day: number, kg: number, reps: number): WorkoutSession => ({
  id, planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'T',
  startedAt: `2026-10-0${day}T10:00:00.000Z`,
  finishedAt: `2026-10-0${day}T11:00:00.000Z`,
  exercises: [{ exerciseId, slotId: null, plan: null, rec: null, sets: [0, 1, 2].map(() => ({ targetKg: null, targetReps: null, actualKg: kg, actualReps: reps, status: 'done' as const })) }],
});

function fixture(): AppData {
  const d = emptyAppData(NOW);
  d.sessions = [1, 3, 5].flatMap((day, i) => [finished(`b${i}`, 'bench-press', day, 60 + i * 2.5, 8 + i), finished(`l${i}`, 'db-lateral-raise', day, 8, 12 + i)]);
  return d;
}

const pending = (reps: number, kg: number): SetRecord[] =>
  [0, 1, 2].map(() => ({ targetReps: reps, targetKg: kg, actualReps: null, actualKg: null, status: 'pending' as const }));

describe('prescribe', () => {
  it('anchor: plan, rec and sets for bench press', () => {
    expect(prescribe(fixture(), 'bench-press', 'anchor', NOW)).toEqual({
      exerciseId: 'bench-press',
      plan: { sets: 3, repMin: 6, repMax: 10, restSec: 150 },
      rec: { kind: 'increase', targetKg: 67.5, targetReps: [6, 6, 6], reason: 'All sets hit 10 at 65 kg. Up to 67.5 kg, aim for 6.' },
      sets: pending(6, 67.5),
    });
  });

  it('accessory: plan, rec and sets for lateral raise', () => {
    expect(prescribe(fixture(), 'db-lateral-raise', 'accessory', NOW)).toEqual({
      exerciseId: 'db-lateral-raise',
      plan: { sets: 3, repMin: 10, repMax: 15, restSec: 90 },
      rec: { kind: 'reps', targetKg: 8, targetReps: [15, 15, 15], reason: 'Keeping 8 kg. Beat 14 · 14 · 14.' },
      sets: pending(15, 8),
    });
  });

  it('after a 15 day break the target holds', () => {
    expect(prescribe(fixture(), 'bench-press', 'anchor', FIFTEEN_DAYS_AFTER_LAST)).toEqual({
      exerciseId: 'bench-press',
      plan: { sets: 3, repMin: 6, repMax: 10, restSec: 150 },
      rec: { kind: 'hold', targetKg: 65, targetReps: [6, 6, 6], reason: 'Back after 15 days. Same 65 kg as last time, no jump yet.' },
      sets: pending(6, 65),
    });
  });

  it('an unknown exercise gives the pick-one recommendation', () => {
    const r = prescribe(fixture(), 'nope', 'anchor');
    expect(r.exerciseId).toBe('');
    expect(r.rec.reason).toBe('No option for your equipment. Pick one.');
  });
});
