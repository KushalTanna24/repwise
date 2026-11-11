import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { overallStrength, setScore } from './strength';
import type { AppData, SessionExercise, WorkoutSession } from './types';

const T0 = '2026-10-05T08:00:00.000Z'; // a Monday

function lift(exerciseId: string, kg: number, reps: number, sets = 3): SessionExercise {
  return { exerciseId, slotId: null, plan: null, rec: null, sets: Array.from({ length: sets }, () => ({ targetKg: null, targetReps: null, actualKg: kg, actualReps: reps, status: 'done' as const })) };
}

function session(id: string, day: number, exercises: SessionExercise[]): WorkoutSession {
  const at = new Date(Date.parse(T0) + day * 86_400_000).toISOString();
  return { id, planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'W', startedAt: at, finishedAt: at, exercises };
}

const withSessions = (sessions: WorkoutSession[]): AppData => ({ ...emptyAppData(T0), sessions });

describe('setScore', () => {
  it('uses estimated one-rep max for weighted lifts', () => {
    expect(setScore('weighted', { targetKg: null, targetReps: null, actualKg: 100, actualReps: 3, status: 'done' })).toBeCloseTo(110);
  });
  it('counts reps for bodyweight, with added load worth extra reps', () => {
    expect(setScore('bodyweight', { targetKg: null, targetReps: null, actualKg: 5, actualReps: 8, status: 'done' })).toBe(10);
  });
});

describe('overallStrength', () => {
  it('is empty without workouts', () => {
    expect(overallStrength(withSessions([]))).toEqual({ points: [], change: null, lifts: [], volume: [] });
  });

  it('indexes each lift against its own start and averages them by week', () => {
    const d = withSessions([
      session('a', 0, [lift('back-squat', 100, 0 + 3), lift('bench-press', 60, 3)]),
      // A week later: squat up 10%, bench unchanged.
      session('b', 7, [lift('back-squat', 110, 3), lift('bench-press', 60, 3)]),
    ]);
    const o = overallStrength(d);
    expect(o.points.map((p) => p.date)).toEqual(['2026-10-05', '2026-10-12']);
    expect(o.points[0].index).toBeCloseTo(100);
    expect(o.points[1].index).toBeCloseTo(105);
    expect(o.change).toBeCloseTo(0.05);
    expect(o.lifts[0]).toMatchObject({ exerciseId: 'back-squat', sessions: 2 });
    expect(o.lifts[0].change).toBeCloseTo(0.1);
  });

  it('adds up weekly volume and ignores sets not done', () => {
    const skipped = { ...lift('back-squat', 100, 5, 1), sets: [{ targetKg: null, targetReps: null, actualKg: 100, actualReps: 5, status: 'skipped' as const }] };
    const o = overallStrength(withSessions([session('a', 0, [lift('back-squat', 100, 5, 2), skipped]), session('b', 2, [lift('bench-press', 50, 10, 1)])]));
    expect(o.volume).toEqual([{ date: '2026-10-05', kg: 1500 }]);
  });

  it('has no change until a lift is done twice', () => {
    expect(overallStrength(withSessions([session('a', 0, [lift('back-squat', 100, 5)])])).change).toBeNull();
  });
});
