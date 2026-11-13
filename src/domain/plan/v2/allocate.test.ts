import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';
import { GROUPS, type Group } from './groups';
import { styleLayout } from './styles';
import type { Targets } from './targets';

const tf = (sets: Partial<Record<Group, number>>): Targets => ({
  sets: { ...(Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>), ...sets },
  focus: new Set(),
  budget: 999,
  exerciseLimit: 6,
  reasons: [],
});

describe('allocate', () => {
  it('spreads sets evenly and converts weekly to per-cycle', () => {
    const a = allocate(styleLayout('upper-lower', 4), tf({ chest: 12 }), 4);
    expect(a.days.map((d) => d.sets.chest ?? 0)).toEqual([6, 0, 6, 0]);
    expect(a.short).toEqual([]);
  });

  it('gives the remainder to earlier days', () => {
    const a = allocate(styleLayout('ppl', 6), tf({ lats: 13 }), 6);
    expect(a.days.map((d) => d.sets.lats ?? 0)).toEqual([0, 7, 0, 0, 6, 0]);
  });

  it('respects the session cap and reports short groups', () => {
    const a = allocate(styleLayout('pairs', 4), tf({ chest: 20 }), 4);
    expect(a.days[0].sets.chest).toBe(10);
    expect(a.short).toContain('chest');
  });

  it('rotation: a 4-day cycle trained 5 days needs fewer sets per cycle day', () => {
    expect(allocate(styleLayout('pairs', 4), tf({ chest: 10 }), 5).days[0].sets.chest).toBe(8);
  });

  it('skips groups with no target and keeps titles and cardio', () => {
    const a = allocate(styleLayout('pairs', 4), tf({ abs: 6 }), 4);
    expect(a.days[0].sets).toEqual({});
    expect(a.days[3]).toEqual({ title: 'Cardio + Abs', cardio: true, sets: { abs: 6 } });
    expect(a.days[0].cardio).toBe(false);
  });
});
