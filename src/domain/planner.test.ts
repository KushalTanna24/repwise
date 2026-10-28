import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { buildPlan, ensurePlan, planKey, rebuildPlan, swapCandidates } from './planner';
import { SPLITS } from './splits';
import type { AppData } from './types';

const NOW = '2026-10-17T08:00:00.000Z';
function data(patch: (d: AppData) => void = () => {}): AppData {
  const d = emptyAppData(NOW);
  d.program.splitId = 'full-body-abc';
  patch(d);
  return d;
}
const at = (idx: number, cycle = 1) => data((d) => (d.program.rotation['full-body-abc'] = { sessionIndex: idx, cycle }));
const ids = (d: AppData) => buildPlan(d, 'full-body-abc').exercises.map((e) => e.exerciseId);

describe('buildPlan', () => {
  it('is deterministic', () => {
    expect(buildPlan(data(), 'full-body-abc')).toEqual(buildPlan(data(), 'full-body-abc'));
  });

  it('A, B and C are different workouts', () => {
    const [a, b, c] = [ids(at(0)), ids(at(1)), ids(at(2))];
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a.filter((x) => c.includes(x))).toEqual([]);
  });

  it('titles and keys follow the rotation', () => {
    const p = buildPlan(at(1, 3), 'full-body-abc');
    expect(p.title).toBe('Full Body B');
    expect(p.key).toBe(planKey('full-body-abc', 1, 3));
    expect(p.cycle).toBe(3);
  });

  it('45 min gives 5 exercises with every anchor kept', () => {
    const d = data((x) => (x.profile.sessionMinutes = 45));
    const p = buildPlan(d, 'full-body-abc');
    expect(p.exercises).toHaveLength(5);
    expect(p.exercises.filter((e) => e.role === 'anchor')).toHaveLength(3);
  });

  it('75 min gives up to 7 exercises', () => {
    const d = data((x) => {
      x.profile.sessionMinutes = 75;
      x.program.rotation['full-body-abc'].sessionIndex = 1;
    });
    expect(buildPlan(d, 'full-body-abc').exercises).toHaveLength(7);
  });

  it('accessories rotate between cycles, anchors do not', () => {
    const c1 = buildPlan(at(0, 1), 'full-body-abc').exercises;
    const c2 = buildPlan(at(0, 2), 'full-body-abc').exercises;
    expect(c1.filter((e) => e.role === 'anchor').map((e) => e.exerciseId)).toEqual(
      c2.filter((e) => e.role === 'anchor').map((e) => e.exerciseId),
    );
    expect(c1.find((e) => e.slotId === 'a-hip')!.exerciseId).not.toBe(c2.find((e) => e.slotId === 'a-hip')!.exerciseId);
  });

  it('exclusions fall through to the next candidate', () => {
    const d = data((x) => (x.profile.excludedExerciseIds = ['back-squat']));
    expect(ids(d)[0]).toBe('hack-squat');
  });

  it('equipment filter applies', () => {
    const d = data((x) => (x.profile.equipment = ['dumbbell', 'bodyweight']));
    expect(ids(d).slice(0, 3)).toEqual(['goblet-squat', 'db-bench-press', 'one-arm-db-row']);
  });

  it('empty slot when no candidate', () => {
    const knee = SPLITS['full-body-abc'].sessions[0].slots[0].candidates;
    const d = data((x) => (x.profile.excludedExerciseIds = knee));
    const first = buildPlan(d, 'full-body-abc').exercises[0];
    expect(first.exerciseId).toBe('');
    expect(first.rec.reason).toContain('No option');
  });

  it('prescription follows objective', () => {
    const hyp = buildPlan(data(), 'full-body-abc').exercises;
    expect(hyp[0]).toMatchObject({ sets: 3, repMin: 6, repMax: 10, restSec: 150 });
    expect(hyp.find((e) => e.role === 'accessory' && e.exerciseId !== 'plank')).toMatchObject({ sets: 3, repMin: 10, repMax: 15, restSec: 90 });
    const str = buildPlan(data((x) => (x.profile.objective = 'strength')), 'full-body-abc').exercises;
    expect(str[0]).toMatchObject({ sets: 4, repMin: 4, repMax: 6 });
  });

  it('timed exercises get seconds', () => {
    const p = buildPlan(data((x) => (x.profile.sessionMinutes = 75)), 'full-body-abc');
    expect(p.exercises.find((e) => e.exerciseId === 'plank')).toMatchObject({ repMin: 30, repMax: 60 });
  });
});

describe('ensurePlan', () => {
  it('builds a plan when missing', () => {
    expect(ensurePlan(data()).plannedSession?.title).toBe('Full Body A');
  });

  it('keeps the same object when the key still matches', () => {
    const d = ensurePlan(data());
    expect(ensurePlan(d)).toBe(d);
  });

  it('rebuilds when rotation moved', () => {
    const d = ensurePlan(data());
    d.program.rotation['full-body-abc'] = { sessionIndex: 1, cycle: 1 };
    expect(ensurePlan(d).plannedSession?.title).toBe('Full Body B');
  });

  it('does nothing without a split', () => {
    const d = data((x) => (x.program.splitId = null));
    expect(ensurePlan(d).plannedSession).toBeNull();
  });
});

describe('swapCandidates', () => {
  it('lists same-pattern exercises, slot candidates first', () => {
    const slot = SPLITS['full-body-abc'].sessions[0].slots[0];
    const list = swapCandidates(slot, data()).map((e) => e.id);
    expect(list.slice(0, 4)).toEqual(slot.candidates);
    expect(list).toContain('bulgarian-split-squat');
    expect(list).not.toContain('bench-press');
  });
});

describe('rebuildPlan', () => {
  it('changes accessories but keeps main lifts and the rotation key', () => {
    const d = ensurePlan(data());
    const before = d.plannedSession!;
    const after = rebuildPlan(d)!.plannedSession!;
    expect(after.key).toBe(before.key);
    expect(after.exercises.filter((e) => e.role === 'anchor').map((e) => e.exerciseId)).toEqual(
      before.exercises.filter((e) => e.role === 'anchor').map((e) => e.exerciseId),
    );
    expect(after.exercises.map((e) => e.exerciseId)).not.toEqual(before.exercises.map((e) => e.exerciseId));
  });

  it('survives ensurePlan (refresh keeps the rebuilt plan)', () => {
    const r = rebuildPlan(ensurePlan(data()))!;
    expect(ensurePlan(r)).toBe(r);
  });

  it('returns null when no accessory has an alternative', () => {
    const d = ensurePlan(data((x) => (x.profile.equipment = ['bodyweight'])));
    const only = d.plannedSession!.exercises.filter((e) => e.role === 'accessory');
    if (only.length === 0) expect(rebuildPlan(d)).toBeNull();
  });
});
describe('session length and experience', () => {
  it('75 min adds a calf finisher to Full Body A, 90 min adds arms too', () => {
    const p75 = buildPlan(data((x) => (x.profile.sessionMinutes = 75)), 'full-body-abc').exercises.map((e) => e.exerciseId);
    expect(p75).toHaveLength(7);
    expect(p75).toContain('standing-calf-raise');
    const p90 = buildPlan(data((x) => (x.profile.sessionMinutes = 90)), 'full-body-abc').exercises.map((e) => e.exerciseId);
    expect(p90).toHaveLength(8);
    expect(new Set(p90).size).toBe(p90.length);
  });

  it('finishers never repeat a pattern the session already trains', () => {
    const b = buildPlan(at(1), 'full-body-abc');
    const p90 = buildPlan(data((x) => { x.profile.sessionMinutes = 90; x.program.rotation['full-body-abc'].sessionIndex = 1; }), 'full-body-abc');
    expect(p90.exercises.filter((e) => e.slotId.startsWith('f-')).map((e) => e.slotId)).toEqual(['f-core']);
    expect(b.exercises.length).toBe(6);
  });

  it('beginners get machines first and one fewer main-lift set', () => {
    const p = buildPlan(data((x) => (x.profile.experience = 'beginner')), 'full-body-abc').exercises;
    expect(p[0]).toMatchObject({ exerciseId: 'hack-squat', sets: 2 });
  });

  it('advanced lifters get one more accessory set', () => {
    const p = buildPlan(data((x) => (x.profile.experience = 'advanced')), 'full-body-abc').exercises;
    expect(p.find((e) => e.role === 'accessory' && e.exerciseId !== 'plank')!.sets).toBe(4);
    expect(p[0].sets).toBe(3);
  });
});
describe('return after a gap', () => {
  const anchor = SPLITS['full-body-abc'].sessions[0].slots[0].candidates[0];
  const back = (date: string, idx = 1): AppData =>
    data((d) => {
      d.program.rotation['full-body-abc'] = { sessionIndex: idx, cycle: 2 };
      d.sessions = [
        {
          id: 'old',
          planKey: null,
          splitId: 'full-body-abc',
          sessionIndex: 0,
          cycle: 2,
          title: 'Full Body A',
          startedAt: `${date}T10:00:00.000Z`,
          finishedAt: `${date}T11:00:00.000Z`,
          exercises: [{ exerciseId: anchor, slotId: null, plan: null, rec: null, sets: [0, 1, 2].map(() => ({ targetKg: null, targetReps: null, actualKg: 100, actualReps: 6, status: 'done' as const })) }],
        },
      ];
    });

  it('three weeks off drops a set and tags the plan', () => {
    const p = buildPlan(back('2026-10-01'), 'full-body-abc', 0, '2026-10-25T09:00:00.000Z');
    expect(p.returnTier).toBe(2);
    expect(buildPlan(back('2026-10-01'), 'full-body-abc', 0, '2026-10-03T09:00:00.000Z').returnTier).toBeUndefined();
  });

  it('rebuilds the cached plan when the tier changes', () => {
    const d = ensurePlan(back('2026-10-20', 1), '2026-10-22T09:00:00.000Z');
    expect(d.plannedSession!.returnTier).toBeUndefined();
    const later = ensurePlan(d, '2026-11-02T09:00:00.000Z');
    expect(later.plannedSession!.returnTier).toBe(1);
    expect(later.plannedSession!.title).toBe('Full Body B');
  });

  it('21+ days off restarts the split at its first session, next cycle', () => {
    const d = ensurePlan(back('2026-10-01', 1), '2026-10-25T09:00:00.000Z');
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 0, cycle: 3 });
    expect(d.plannedSession!.title).toBe('Full Body A');
    expect(d.plannedSession!.exercises.find((e) => e.exerciseId === anchor)!.rec.targetKg).toBe(85);
  });

  it('does not touch the rotation mid-workout', () => {
    const d = back('2026-10-01', 1);
    d.activeSession = { ...d.sessions[0], id: 'live', finishedAt: null };
    expect(ensurePlan(d, '2026-10-25T09:00:00.000Z').program.rotation['full-body-abc'].sessionIndex).toBe(1);
  });
});
