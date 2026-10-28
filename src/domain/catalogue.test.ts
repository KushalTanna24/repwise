import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, emptyAppData, getExercise } from './catalogue';
import { SPLITS } from './splits';

describe('catalogue', () => {
  it('has unique exercise ids', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every split candidate exists in the catalogue', () => {
    for (const split of Object.values(SPLITS))
      for (const s of split.sessions)
        for (const slot of s.slots)
          for (const id of slot.candidates) expect(getExercise(id, []), `${split.id}/${slot.id}/${id}`).toBeDefined();
  });

  it('full body sessions are A, B, C', () => {
    expect(SPLITS['full-body-abc'].sessions.map((s) => s.title)).toEqual(['Full Body A', 'Full Body B', 'Full Body C']);
  });

  it('full body anchors cover the six main patterns across the cycle', () => {
    const patterns = new Set(
      SPLITS['full-body-abc'].sessions.flatMap((s) => s.slots.filter((x) => x.role === 'anchor').map((x) => x.pattern)),
    );
    for (const p of ['knee', 'hip', 'hpush', 'vpush', 'hpull', 'vpull']) expect(patterns.has(p as never), p).toBe(true);
  });

  it('hybrid PPL pairs chest with biceps, back with triceps, legs with shoulders', () => {
    const [push, pull, legs] = SPLITS['ppl-hybrid'].sessions;
    const patterns = (s: typeof push) => new Set(s.slots.map((x) => x.pattern));
    const arms = (s: typeof push) => s.slots.filter((x) => x.pattern === 'arms').flatMap((x) => x.candidates);
    expect(patterns(push)).toEqual(new Set(['hpush', 'arms']));
    expect(arms(push).every((id) => /curl/.test(id))).toBe(true);
    expect(patterns(pull)).toEqual(new Set(['vpull', 'hpull', 'arms']));
    expect(arms(pull).every((id) => /triceps|dip/.test(id))).toBe(true);
    expect(patterns(legs)).toEqual(new Set(['knee', 'hip', 'vpush', 'shoulders', 'calves']));
  });

  it('getExercise finds custom exercises', () => {
    const custom = [{ id: 'custom-x', name: 'X', muscle: 'Back', pattern: 'hpull', equipment: 'cable', kind: 'weighted', custom: true } as const];
    expect(getExercise('custom-x', [...custom])?.name).toBe('X');
  });

  it('emptyAppData has no split and zeroed rotation', () => {
    const d = emptyAppData('2026-10-17T00:00:00.000Z');
    expect(d.program.splitId).toBeNull();
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 0, cycle: 1 });
    expect(d.profile.equipment.length).toBe(5);
  });
});
