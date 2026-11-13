import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { estimateFinish, estimatePlanMs, historyPaceMs } from './eta';
import { ensurePlan } from './training';
import { confirmSet, skipExercise, startSession, updateSet } from './session';
import type { AppData, WorkoutSession } from './types';

const T0 = '2026-10-17T08:00:00.000Z';
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000).toISOString();
const ms = (sec: number) => Date.parse(at(sec));

function started(): AppData {
  const d = emptyAppData(T0);
  d.program.splitId = 'full-body-abc';
  return startSession(ensurePlan(d), T0, 'w1');
}
const tick = (d: AppData, ex: number, set: number, sec: number) => confirmSet(updateSet(d, ex, set, { actualKg: 40, actualReps: 8 }), ex, set, at(sec));
const pending = (d: AppData) => d.activeSession!.exercises.reduce((n, e) => n + (e.skipped ? 0 : e.sets.filter((s) => s.status === 'pending').length), 0);

/** A finished workout of `sets` done sets lasting `minutes`. */
function past(id: string, minutes: number, sets: number, dayOffset: number): WorkoutSession {
  const start = Date.parse(T0) - dayOffset * 86_400_000;
  return {
    id,
    planKey: null,
    splitId: null,
    sessionIndex: null,
    cycle: null,
    title: 'Past',
    startedAt: new Date(start).toISOString(),
    finishedAt: new Date(start + minutes * 60_000).toISOString(),
    exercises: [{ exerciseId: 'back-squat', slotId: null, plan: null, rec: null, sets: Array.from({ length: sets }, () => ({ targetKg: null, targetReps: null, actualKg: 40, actualReps: 8, status: 'done' as const })) }],
  };
}

describe('estimatePlanMs', () => {
  const planned = () => ensurePlan({ ...emptyAppData(T0), program: { ...emptyAppData(T0).program, splitId: 'full-body-abc' } });

  it('matches the estimate of the same workout just started', () => {
    const d = planned();
    const started = startSession(d, T0, 'w1');
    expect(estimatePlanMs(d.plannedSession!, [])).toBe(estimateFinish(started.activeSession!, [], ms(0)).remainingMs);
  });

  it('uses past pace when there is history', () => {
    const d = planned();
    const sets = d.plannedSession!.exercises.reduce((n, e) => n + (e.exerciseId ? e.sets : 0), 0);
    expect(estimatePlanMs(d.plannedSession!, [past('a', 50, 20, 1)])).toBe(sets * 150_000);
  });
});

describe('historyPaceMs', () => {
  it('is null with no usable history', () => {
    expect(historyPaceMs([])).toBeNull();
  });

  it('takes the median time per done set of recent workouts', () => {
    const sessions = [past('a', 60, 20, 3), past('b', 40, 20, 2), past('c', 50, 20, 1)];
    expect(historyPaceMs(sessions)).toBe(150_000);
  });

  it('ignores imported workouts with no real duration and tiny workouts', () => {
    const sessions = [past('legacy', 0, 20, 3), past('tiny', 30, 2, 2), past('real', 40, 20, 1)];
    expect(historyPaceMs(sessions)).toBe(120_000);
  });
});

describe('estimateFinish', () => {
  it('uses the plan before anything is done and there is no history', () => {
    const d = started();
    const eta = estimateFinish(d.activeSession!, d.sessions, ms(0))!;
    expect(eta.setsDone).toBe(0);
    expect(eta.setsLeft).toBe(pending(d));
    expect(eta.basis).toBe('plan');
    // Every set costs at least its work time plus rest.
    expect(eta.remainingMs).toBeGreaterThan(eta.setsLeft * 60_000);
    expect(eta.endsAt).toBe(ms(0) + eta.remainingMs);
  });

  it('falls back to past workouts before this one has a pace', () => {
    const d = { ...started(), sessions: [past('a', 50, 20, 1)] };
    const eta = estimateFinish(d.activeSession!, d.sessions, ms(0))!;
    expect(eta.basis).toBe('history');
    expect(eta.remainingMs).toBe(eta.setsLeft * 150_000);
  });

  it('moves to this workout’s own pace as sets get done', () => {
    let d = { ...started(), sessions: [past('a', 50, 20, 1)] };
    // Six sets, one every two minutes: a 120 s pace.
    for (let i = 0; i < 6; i++) d = tick(d, Math.floor(i / 3), i % 3, 120 * (i + 1));
    const eta = estimateFinish(d.activeSession!, d.sessions, ms(720))!;
    expect(eta.basis).toBe('session');
    expect(eta.setsDone).toBe(6);
    expect(eta.remainingMs).toBe(eta.setsLeft * 120_000);
  });

  it('counts time already spent since the last set, up to one set', () => {
    let d = { ...started(), sessions: [past('a', 50, 20, 1)] };
    for (let i = 0; i < 6; i++) d = tick(d, Math.floor(i / 3), i % 3, 120 * (i + 1));
    const fresh = estimateFinish(d.activeSession!, d.sessions, ms(720))!;
    const later = estimateFinish(d.activeSession!, d.sessions, ms(780))!;
    expect(later.endsAt).toBe(fresh.endsAt);
    // Long stall: the finish slides out once the current set is overdue.
    const stalled = estimateFinish(d.activeSession!, d.sessions, ms(1500))!;
    expect(stalled.endsAt).toBeGreaterThan(fresh.endsAt);
  });

  it('leaves skipped exercises out', () => {
    const d = started();
    const before = estimateFinish(d.activeSession!, d.sessions, ms(0))!;
    const after = estimateFinish(skipExercise(d, 0).activeSession!, d.sessions, ms(0))!;
    expect(after.setsLeft).toBe(before.setsLeft - d.activeSession!.exercises[0].sets.length);
  });

  it('is zero once every set is ticked or skipped', () => {
    let d = started();
    d.activeSession!.exercises.forEach((_, i) => (d = skipExercise(d, i)));
    const eta = estimateFinish(d.activeSession!, d.sessions, ms(60))!;
    expect(eta.setsLeft).toBe(0);
    expect(eta.remainingMs).toBe(0);
  });
});
