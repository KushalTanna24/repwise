import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { ensurePlan } from './planner';
import {
  addExercise,
  addSet,
  confirmSet,
  deleteHistorySession,
  discardSession,
  editHistorySet,
  finishSession,
  moveExercise,
  setSplit,
  skipExercise,
  skipPlannedSession,
  skipSet,
  startSession,
  swapExercise,
  updateProfile,
  updateSet,
} from './session';
import type { AppData } from './types';

const T0 = '2026-10-17T08:00:00.000Z';
const T1 = '2026-10-17T09:00:00.000Z';

function fresh(): AppData {
  const d = emptyAppData(T0);
  d.program.splitId = 'full-body-abc';
  return ensurePlan(d);
}
const started = () => startSession(fresh(), T0, 'w1');
/** Start, tick the first set with typed values, finish. */
function complete(d: AppData, id: string): AppData {
  let x = startSession(ensurePlan(d), T0, id);
  x = updateSet(x, 0, 0, { actualKg: 60, actualReps: 8 });
  x = confirmSet(x, 0, 0);
  return finishSession(x, T1);
}

describe('startSession', () => {
  it('copies plan targets into pending sets with empty actuals', () => {
    const d = started();
    const s = d.activeSession!;
    expect(s.title).toBe('Full Body A');
    expect(s.planKey).toBe('full-body-abc:0:1');
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].sets[0]).toMatchObject({ status: 'pending', actualKg: null, actualReps: null, targetReps: 6 });
  });

  it('does not replace an active session', () => {
    const d = started();
    expect(startSession(d, T1, 'w2')).toBe(d);
  });
});

describe('set logging', () => {
  it('confirmSet keeps typed values', () => {
    let d = updateSet(started(), 0, 0, { actualKg: 62.5, actualReps: 7 });
    d = confirmSet(d, 0, 0);
    expect(d.activeSession!.exercises[0].sets[0]).toMatchObject({ actualKg: 62.5, actualReps: 7, status: 'done' });
  });

  it('confirmSet fills empty actuals from targets when a target load exists', () => {
    let d = started();
    d = {
      ...d,
      activeSession: {
        ...d.activeSession!,
        exercises: d.activeSession!.exercises.map((e, i) => (i ? e : { ...e, sets: e.sets.map((s) => ({ ...s, targetKg: 40 })) })),
      },
    };
    d = confirmSet(d, 0, 1);
    expect(d.activeSession!.exercises[0].sets[1]).toMatchObject({ actualKg: 40, actualReps: 6, status: 'done' });
  });

  it('confirmSet refuses a weighted set with no load at all', () => {
    const d = started();
    expect(confirmSet(d, 0, 0)).toBe(d);
  });

  it('skipSet and addSet', () => {
    let d = skipSet(started(), 0, 2);
    expect(d.activeSession!.exercises[0].sets[2].status).toBe('skipped');
    d = addSet(d, 0);
    expect(d.activeSession!.exercises[0].sets).toHaveLength(4);
    expect(d.activeSession!.exercises[0].sets[3].status).toBe('pending');
  });

  it('skipExercise marks pending sets skipped', () => {
    const d = skipExercise(started(), 1);
    expect(d.activeSession!.exercises[1].skipped).toBe(true);
    expect(d.activeSession!.exercises[1].sets.every((s) => s.status === 'skipped')).toBe(true);
  });

  it('moveExercise reorders', () => {
    const before = started().activeSession!.exercises.map((e) => e.exerciseId);
    const after = moveExercise(started(), 0, 2).activeSession!.exercises.map((e) => e.exerciseId);
    expect(after).toEqual([before[1], before[2], before[0], ...before.slice(3)]);
  });

  it('addExercise appends with a prescription', () => {
    const d = addExercise(started(), 'db-curl');
    const last = d.activeSession!.exercises.at(-1)!;
    expect(last.exerciseId).toBe('db-curl');
    expect(last.sets).toHaveLength(3);
  });

  it('swapExercise replaces a not-yet-started exercise', () => {
    const d = swapExercise(started(), 0, 'hack-squat');
    expect(d.activeSession!.exercises[0].exerciseId).toBe('hack-squat');
    expect(d.activeSession!.exercises[0].rec?.kind).toBe('first');
  });

  it('swapExercise is refused once a set is done', () => {
    const d = confirmSet(updateSet(started(), 0, 0, { actualKg: 60, actualReps: 8 }), 0, 0);
    expect(swapExercise(d, 0, 'hack-squat')).toBe(d);
  });
});

describe('assisted bodyweight sets', () => {
  it('keeps the assistance target on rec and only fills it in when the set is ticked', () => {
    let d = fresh();
    const plan = d.plannedSession!;
    d = {
      ...d,
      plannedSession: {
        ...plan,
        exercises: [
          { ...plan.exercises[0], exerciseId: 'pull-up', rec: { kind: 'assist', targetKg: 0, assistKg: 15, targetReps: [6, 6, 6], reason: 'r' } },
        ],
      },
    };
    d = startSession(d, T0, 'w1');
    expect(d.activeSession!.exercises[0].sets[0].assistKg).toBeNull();
    d = confirmSet(d, 0, 0);
    expect(d.activeSession!.exercises[0].sets[0]).toMatchObject({ assistKg: 15, actualReps: 6, actualKg: 0, status: 'done' });
  });
});

describe('finishing and rotation', () => {
  it('finishing A moves to B and clears the plan', () => {
    const d = complete(fresh(), 'w1');
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 1, cycle: 1 });
    expect(d.plannedSession).toBeNull();
    expect(d.activeSession).toBeNull();
    expect(d.sessions).toHaveLength(1);
    expect(d.sessions[0].finishedAt).toBe(T1);
  });

  it('A → B → C → A of cycle 2', () => {
    let d = fresh();
    d = complete(d, 'a');
    d = complete(d, 'b');
    expect(ensurePlan(d).plannedSession?.title).toBe('Full Body C');
    d = complete(d, 'c');
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 0, cycle: 2 });
    expect(ensurePlan(d).plannedSession?.title).toBe('Full Body A');
  });

  it('finishSession is idempotent', () => {
    const once = complete(fresh(), 'w1');
    const twice = finishSession(once, T1);
    expect(twice.program.rotation).toEqual(once.program.rotation);
    expect(twice.sessions).toHaveLength(1);
  });

  it('does not advance twice if the same session id is already saved', () => {
    const once = complete(fresh(), 'w1');
    const replay = finishSession({ ...once, activeSession: { ...once.sessions[0], finishedAt: null } }, T1);
    expect(replay.sessions).toHaveLength(1);
    expect(replay.program.rotation).toEqual(once.program.rotation);
  });

  it('refuses to finish with no done sets', () => {
    const d = started();
    expect(finishSession(d, T1)).toBe(d);
  });

  it('pending sets become skipped when finished', () => {
    const d = complete(fresh(), 'w1');
    expect(d.sessions[0].exercises[0].sets.map((s) => s.status)).toEqual(['done', 'skipped', 'skipped']);
  });

  it('discard does not advance', () => {
    const d = discardSession(started());
    expect(d.activeSession).toBeNull();
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 0, cycle: 1 });
  });

  it('skipPlannedSession advances once and only without an active session', () => {
    const d = skipPlannedSession(fresh());
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 1, cycle: 1 });
    const a = started();
    expect(skipPlannedSession(a)).toBe(a);
  });

  it('editing or deleting history leaves rotation alone', () => {
    const d = complete(fresh(), 'w1');
    const e = editHistorySet(d, 'w1', 0, 0, { actualReps: 10 });
    expect(e.sessions[0].exercises[0].sets[0].actualReps).toBe(10);
    expect(e.program.rotation).toEqual(d.program.rotation);
    const x = deleteHistorySession(d, 'w1');
    expect(x.sessions).toHaveLength(0);
    expect(x.program.rotation).toEqual(d.program.rotation);
  });
});

describe('setSplit', () => {
  it('switching keeps each split rotation and clears the plan', () => {
    let d = complete(fresh(), 'w1');
    d = setSplit(ensurePlan(d), 'ppl');
    expect(d.program.splitId).toBe('ppl');
    expect(d.plannedSession).toBeNull();
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 1, cycle: 1 });
    expect(ensurePlan(d).plannedSession?.title).toBe('Push');
    d = setSplit(d, 'full-body-abc');
    expect(ensurePlan(d).plannedSession?.title).toBe('Full Body B');
  });

  it('is refused during a workout', () => {
    const d = started();
    expect(setSplit(d, 'ppl')).toBe(d);
  });
});

describe('updateProfile', () => {
  it('rebuilds the upcoming plan but leaves rotation and split alone', () => {
    const d = updateProfile(fresh(), { sessionMinutes: 45 });
    expect(d.profile.sessionMinutes).toBe(45);
    expect(d.plannedSession).toBeNull();
    expect(ensurePlan(d).plannedSession?.exercises).toHaveLength(5);
    expect(d.program).toEqual(fresh().program);
  });

  it('keeps an in-progress workout untouched', () => {
    const d = updateProfile(started(), { objective: 'strength' });
    expect(d.activeSession).toEqual(started().activeSession);
  });
});
