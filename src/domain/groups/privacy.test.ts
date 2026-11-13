import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { AppData } from '../types';
import { BODY_ARRAY_KEYS, BODY_PROFILE_KEYS, stripForGroup } from './privacy';

const NOW = '2026-11-13T08:00:00.000Z';

function full(): AppData {
  const d = emptyAppData(NOW);
  d.profile = { ...d.profile, heightCm: 180, targetWeightKg: 75, sex: 'male', birthYear: 1970, activity: 'feet', bodyGoal: 'lose', intakeKcal: 2200, goalNote: 'get lean', displayName: 'Raj', focus: ['chest'] };
  d.bodyweights = [{ id: 'w1', date: '2026-11-01', kg: 82 }];
  d.photos = [{ id: 'p1', date: '2026-11-01', path: 'u/p1.jpg' }];
  d.fasts = [{ id: 'f1', startedAt: NOW, endedAt: null, targetHours: 16 }];
  d.suppLog = { '2026-11-01': ['creatine'] };
  d.exerciseNotes = { squat: { think: 'brace' } };
  d.water = { '2026-11-01': 6 };
  d.program.splitId = 'ppl';
  return d;
}

describe('stripForGroup', () => {
  it('strips body arrays and profile keys when shareBody is false', () => {
    const out = stripForGroup(full(), false);
    for (const k of BODY_ARRAY_KEYS) expect(out[k], k).toEqual(k === 'suppLog' ? {} : []);
    for (const k of BODY_PROFILE_KEYS) expect(k in out.profile, k).toBe(false);
  });

  it('keeps body data when shareBody is true', () => {
    const out = stripForGroup(full(), true);
    expect(out.bodyweights).toHaveLength(1);
    expect(out.photos).toHaveLength(1);
    expect(out.profile.heightCm).toBe(180);
  });

  it('always removes exerciseNotes and displayName', () => {
    for (const share of [true, false]) {
      const out = stripForGroup(full(), share);
      expect(out.exerciseNotes).toEqual({});
      expect('displayName' in out.profile).toBe(false);
    }
  });

  it('keeps water, goals, sessions, program and focus', () => {
    const src = full();
    const out = stripForGroup(src, false);
    expect(out.water).toEqual(src.water);
    expect(out.goals).toBe(src.goals);
    expect(out.sessions).toBe(src.sessions);
    expect(out.program.splitId).toBe('ppl');
    expect(out.profile.focus).toEqual(['chest']);
  });

  it('empties active session sets but keeps start time and exercise ids', () => {
    const src = full();
    src.activeSession = {
      id: 's', planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'Push', startedAt: NOW, finishedAt: null,
      exercises: [{ exerciseId: 'bench', slotId: null, plan: null, rec: null, sets: [{ targetKg: 60, targetReps: 8, actualKg: 60, actualReps: 8, status: 'done' }] }],
    };
    const out = stripForGroup(src, true);
    expect(out.activeSession?.startedAt).toBe(NOW);
    expect(out.activeSession?.exercises[0].exerciseId).toBe('bench');
    expect(out.activeSession?.exercises[0].sets).toEqual([]);
  });

  it('does not mutate its input', () => {
    const src = full();
    const before = JSON.stringify(src);
    stripForGroup(src, false);
    expect(JSON.stringify(src)).toBe(before);
  });
});
