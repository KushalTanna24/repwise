import { describe, expect, it } from 'vitest';
import type { SessionExercise, SetRecord, WorkoutSession } from '../types';
import { swapSignals } from './learn';

const done: SetRecord = { targetReps: 8, targetKg: 50, actualReps: 8, actualKg: 50, status: 'done' };
const ex = (exerciseId: string, slotId: string | null, swappedFrom?: string, sets = [done]): SessionExercise => ({
  exerciseId,
  slotId,
  plan: null,
  rec: null,
  sets,
  ...(swappedFrom ? { swappedFrom } : {}),
});
const session = (id: string, startedAt: string, exercises: SessionExercise[], finishedAt: string | null = startedAt): WorkoutSession => ({
  id,
  planKey: null,
  splitId: 'ppl',
  sessionIndex: 0,
  cycle: 1,
  title: 'Push',
  startedAt,
  finishedAt,
  exercises,
});

describe('swapSignals', () => {
  it('counts what each planned exercise gets swapped for, most common first', () => {
    const sessions = [
      session('a', '2026-11-01T08:00:00.000Z', [ex('db-bench-press', 'p-hpush', 'bench-press')]),
      session('b', '2026-11-04T08:00:00.000Z', [ex('machine-chest-press', 'p-hpush', 'bench-press')]),
      session('c', '2026-11-08T08:00:00.000Z', [ex('db-bench-press', 'p-hpush', 'bench-press')]),
      session('d', '2026-11-11T08:00:00.000Z', [ex('bench-press', 'p-hpush')]),
    ];
    expect(swapSignals({ sessions })).toEqual([
      {
        splitId: 'ppl',
        slotId: 'p-hpush',
        from: 'bench-press',
        seen: 4,
        to: [
          { exerciseId: 'db-bench-press', count: 2, lastAt: '2026-11-08T08:00:00.000Z' },
          { exerciseId: 'machine-chest-press', count: 1, lastAt: '2026-11-04T08:00:00.000Z' },
        ],
      },
    ]);
  });

  it('ignores unfinished sessions, extras added by hand and exercises with no done sets', () => {
    const skipped: SetRecord[] = [{ ...done, status: 'skipped' }];
    const sessions = [
      session('a', '2026-11-01T08:00:00.000Z', [ex('db-bench-press', 'p-hpush', 'bench-press')], null),
      session('b', '2026-11-02T08:00:00.000Z', [ex('db-curl', null, 'cable-curl')]),
      session('c', '2026-11-03T08:00:00.000Z', [ex('db-bench-press', 'p-hpush', 'bench-press', skipped)]),
    ];
    expect(swapSignals({ sessions })).toEqual([]);
  });
});
