import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, emptyAppData } from './catalogue';
import { exerciseMuscles, muscleHeat, MUSCLES } from './muscles';
import type { AppData, Exercise, WorkoutSession } from './types';

const NOW = '2026-10-17T12:00:00';

function sess(id: string, date: string, ex: Record<string, number>, finished = true): WorkoutSession {
  return {
    id,
    planKey: null,
    splitId: null,
    sessionIndex: null,
    cycle: null,
    title: 'T',
    startedAt: `${date}T08:00:00`,
    finishedAt: finished ? `${date}T09:00:00` : null,
    exercises: Object.entries(ex).map(([exerciseId, n]) => ({
      exerciseId,
      slotId: null,
      plan: null,
      rec: null,
      sets: [
        ...Array.from({ length: n }, () => ({ targetKg: null, targetReps: null, actualKg: 50, actualReps: 8, status: 'done' as const })),
        { targetKg: null, targetReps: null, actualKg: null, actualReps: null, status: 'skipped' as const },
      ],
    })),
  };
}
const withSessions = (sessions: WorkoutSession[]): AppData => ({ ...emptyAppData(NOW), sessions });

describe('exerciseMuscles', () => {
  it('every built-in exercise names at least one primary muscle', () => {
    for (const e of BUILTIN_EXERCISES) expect(exerciseMuscles(e).primary.length, e.id).toBeGreaterThan(0);
  });

  it('only uses known muscles', () => {
    for (const e of BUILTIN_EXERCISES) {
      const m = exerciseMuscles(e);
      for (const x of [...m.primary, ...m.secondary]) expect(MUSCLES, `${e.id}/${x}`).toContain(x);
    }
  });

  it('custom exercises fall back to their pattern, arms read the muscle text', () => {
    const custom = (pattern: Exercise['pattern'], muscle: string): Exercise => ({ id: 'c', name: 'C', muscle, pattern, equipment: 'cable', kind: 'weighted', custom: true });
    expect(exerciseMuscles(custom('hpush', 'Chest')).primary).toEqual(['chest']);
    expect(exerciseMuscles(custom('arms', 'Triceps')).primary).toEqual(['triceps']);
    expect(exerciseMuscles(custom('arms', 'Forearms')).primary).toEqual(['forearms']);
    expect(exerciseMuscles(custom('arms', 'Biceps')).primary).toEqual(['biceps']);
  });
});

describe('muscleHeat', () => {
  it('nothing trained reads cold everywhere', () => {
    const h = muscleHeat(withSessions([]), NOW);
    expect(MUSCLES.every((m) => h[m].heat === 0 && h[m].sets === 0 && h[m].last === null)).toBe(true);
  });

  it('primary sets count fully, secondary half, skipped sets not at all', () => {
    const h = muscleHeat(withSessions([sess('1', '2026-10-17', { 'bench-press': 4 })]), NOW);
    expect(h.chest.sets).toBe(4);
    expect(h.triceps.sets).toBe(2);
    expect(h.chest.last).toBe('2026-10-17');
    expect(h.chest.heat).toBeCloseTo(4 / 8);
  });

  it('heat fades with age and is gone after a week; sets cover the last 7 days', () => {
    const d = withSessions([sess('1', '2026-10-14', { 'leg-curl': 8 }), sess('2', '2026-10-10', { 'back-squat': 8 })]);
    const h = muscleHeat(d, NOW);
    // 3 days old: 8 sets × (1 − 3/7).
    expect(h.hamstrings.heat).toBeCloseTo((8 * (4 / 7)) / 8);
    expect(h.hamstrings.sets).toBe(8);
    // 7 days old: outside the window, but still remembered as last trained.
    expect(h.quads.heat).toBe(0);
    expect(h.quads.sets).toBe(0);
    expect(h.quads.last).toBe('2026-10-10');
  });

  it('heat caps at 1 and unfinished workouts do not count', () => {
    const h = muscleHeat(withSessions([sess('1', '2026-10-17', { 'leg-press': 20 }), sess('2', '2026-10-17', { 'db-curl': 5 }, false)]), NOW);
    expect(h.quads.heat).toBe(1);
    expect(h.biceps.sets).toBe(0);
  });
});
