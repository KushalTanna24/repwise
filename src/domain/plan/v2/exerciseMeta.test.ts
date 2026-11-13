import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '../../catalogue';
import { META, metaFor, primaryGroups } from './exerciseMeta';
import { GROUPS } from './groups';

describe('exercise metadata', () => {
  it('covers every built-in non-calisthenics exercise with valid groups', () => {
    for (const ex of BUILTIN_EXERCISES.filter((e) => !e.calisthenics)) {
      const m = META[ex.id];
      expect(m, ex.id).toBeDefined();
      for (const g of Object.keys(m.muscles)) expect(GROUPS, `${ex.id}/${g}`).toContain(g);
      if (ex.pattern !== 'cardio') expect(primaryGroups(m).length, ex.id).toBeGreaterThan(0);
    }
  });

  it('pins the aesthetic distinctions', () => {
    expect(META['db-lateral-raise'].muscles).toEqual({ 'side-delts': 1 });
    expect(META['overhead-press'].muscles['front-delts']).toBe(1);
    expect(META['overhead-press'].muscles['side-delts']).toBe(0.5);
    expect(META['incline-db-press'].muscles).toMatchObject({ 'upper-chest': 1, chest: 0.5, 'front-delts': 0.5, triceps: 0.5 });
    expect(META['overhead-triceps-extension'].stretch).toBe(true);
    expect(META['back-squat'].fatigue).toBe('high');
    expect(META['face-pull'].muscles['rear-delts']).toBe(1);
    expect(META['db-shrug'].muscles).toEqual({ traps: 1, forearms: 0.5 });
    expect(META['incline-walk'].muscles).toEqual({});
    expect(META['plate-neck-curl'].muscles).toEqual({ neck: 1 });
    expect(META['lat-pulldown'].muscles.lats).toBe(1);
    expect(META['seated-cable-row'].muscles['upper-back']).toBe(1);
  });

  it('marks compounds the same way v1 did', () => {
    expect(META['bench-press'].compound).toBe(true);
    expect(META['leg-curl'].compound).toBe(false);
    expect(META['cable-fly'].compound).toBe(false);
    expect(META['straight-arm-pulldown'].compound).toBe(false);
    expect(META['pec-deck'].compound).toBe(false);
  });

  it('flags high-skill barbell lifts', () => {
    expect(META['back-squat'].skill).toBe('high');
    expect(META['barbell-row'].skill).toBe('high');
    expect(META['leg-press'].skill).toBe('low');
  });

  it('derives a fallback for custom exercises', () => {
    const m = metaFor({ id: 'c1', name: 'Landmine press', muscle: 'Shoulders', pattern: 'vpush', equipment: 'barbell', kind: 'weighted', custom: true });
    expect(m.muscles['front-delts']).toBe(1);
    expect(m.muscles.triceps).toBe(0.5);
    expect(m).toMatchObject({ tier: 'B', compound: true, skill: 'low', stretch: false, fatigue: 'medium' });
    const raise = metaFor({ id: 'c2', name: 'Lean-away raise', muscle: 'Side delts', pattern: 'shoulders', equipment: 'dumbbell', kind: 'weighted', custom: true });
    expect(raise.muscles['side-delts']).toBe(1);
    expect(raise.compound).toBe(false);
  });
});
