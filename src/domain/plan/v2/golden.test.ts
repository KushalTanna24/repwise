import { describe, expect, it } from 'vitest';
import { validateSplit } from '../../training';
import { NOW } from './fixtures';
import { GOLDEN, dataFor } from './goldenProfiles';
import { generatePlanV2, type PlanResultV2 } from './generate';
import { GROUPS, type Group } from './groups';
import { planDistance } from './score';

const strip = (r: PlanResultV2) => r.split.sessions.map((s) => ({ ...s, slots: s.slots.map(({ id: _id, ...rest }) => rest) }));

for (const [name, g] of Object.entries(GOLDEN)) {
  describe(`golden: ${name}`, () => {
    const d = dataFor(g);
    it('holds the invariants across 4 regenerate steps', () => {
      let shown: string[][][] = [];
      for (let step = 0; step < 4; step++) {
        const r = generatePlanV2(d, { style: g.style, seed: 1, shown }, NOW);
        for (const grp of GROUPS) if (r.targets.sets[grp] > 0 && !r.limited.includes(grp) && !r.short.includes(grp)) expect(r.daysHit[grp], `${step}/${grp}`).toBeGreaterThan(0);
        for (const grp of r.targets.focus)
          if (!r.limited.includes(grp) && !r.short.includes(grp)) expect(r.achieved[grp], `${step}/${grp}`).toBeGreaterThanOrEqual(0.9 * r.targets.sets[grp]);
        for (const s of r.split.sessions) expect(s.slots.filter((x) => x.pattern !== 'cardio').length).toBeLessThanOrEqual(r.targets.exerciseLimit);
        if (d.profile.planGoal === 'look') expect(r.achieved['side-delts']).toBeGreaterThanOrEqual(8);
        if (!r.exhausted) for (const prev of shown) expect(planDistance(prev, r.picks)).toBeGreaterThanOrEqual(0.4);
        expect(validateSplit(r.split)).toBeNull();
        shown = [...shown, r.picks];
      }
    });

  });
}

describe('generatePlanV2', () => {
  it('same seed and data give the same plan', () => {
    const d = dataFor(GOLDEN.maleLook);
    expect(strip(generatePlanV2(d, { style: 'auto', seed: 3, shown: [] }, NOW))).toEqual(strip(generatePlanV2(d, { style: 'auto', seed: 3, shown: [] }, NOW)));
  });

  it('20 candidates generate in under 50 ms', () => {
    const d = dataFor(GOLDEN.advanced6);
    generatePlanV2(d, { style: 'ppl', seed: 1, shown: [] }, NOW);
    // Fastest of three, so a busy test runner measures the code, not the machine.
    const runs = [2, 3, 4].map((seed) => {
      const t0 = performance.now();
      generatePlanV2(d, { style: 'ppl', seed, shown: [] }, NOW);
      return performance.now() - t0;
    });
    expect(Math.min(...runs)).toBeLessThan(50);
  });

  it('regenerate gives a properly different plan on a full gym', () => {
    const d = dataFor(GOLDEN.ownerPairs5);
    const first = generatePlanV2(d, { style: 'pairs', seed: 1, shown: [] }, NOW);
    const second = generatePlanV2(d, { style: 'pairs', seed: 1, shown: [first.picks] }, NOW);
    expect(second.exhausted).toBe(false);
    expect(planDistance(first.picks, second.picks)).toBeGreaterThanOrEqual(0.4);
    expect(second.style).toBe('pairs');
  });

  it('a group with nothing eligible is limited, not a crash', () => {
    const d = dataFor({ ...GOLDEN.beginner2, equipment: ['bodyweight'], excluded: ['back-extension'] });
    const r = generatePlanV2(d, { style: 'auto', seed: 1, shown: [] }, NOW);
    expect(r.limited).toContain('side-delts');
    expect(validateSplit(r.split)).toBeNull();
  });

  it('drops a day the equipment cannot fill instead of rejecting the plan', () => {
    for (const equipment of [['bodyweight'], ['barbell']] as const) {
      const d = dataFor({ ...GOLDEN.ownerPairs5, daysPerWeek: equipment[0] === 'barbell' ? 4 : 5, equipment: [...equipment] });
      const r = generatePlanV2(d, { style: 'pairs', seed: 1, shown: [] }, NOW);
      expect(validateSplit(r.split), equipment[0]).toBeNull();
      expect(r.split.sessions.every((s) => s.slots.length > 0)).toBe(true);
      expect(r.layout).toHaveLength(r.split.sessions.length);
    }
  });

  it('a tiny pool exhausts regenerate and reports it', () => {
    const d = dataFor({ ...GOLDEN.beginner2, equipment: ['bodyweight'] });
    let shown: string[][][] = [];
    let exhausted = false;
    for (let i = 0; i < 30 && !exhausted; i++) {
      const r = generatePlanV2(d, { style: 'auto', seed: 1, shown }, NOW);
      exhausted = r.exhausted;
      shown = [...shown, r.picks];
    }
    expect(exhausted).toBe(true);
  });

  it('uses custom pairs, and falls back to auto when they are invalid', () => {
    const d = dataFor(GOLDEN.ownerPairs5);
    const custom = [
      { title: 'Chest + Biceps', groups: ['upper-chest', 'chest', 'biceps'] as Group[] },
      { title: 'Back + Triceps', groups: ['lats', 'upper-back', 'traps', 'triceps'] as Group[] },
      { title: 'Shoulders + Legs', groups: ['side-delts', 'rear-delts', 'quads', 'hamstrings', 'glutes', 'calves'] as Group[] },
      { title: 'Cardio + Abs', groups: ['abs'] as Group[], cardio: true },
    ];
    const r = generatePlanV2(d, { style: 'custom', customPairs: custom, seed: 1, shown: [] }, NOW);
    expect(r.style).toBe('custom');
    expect(r.split.sessions.map((s) => s.title)).toEqual(custom.map((c) => c.title));
    const bad = generatePlanV2(d, { style: 'custom', customPairs: [custom[0]], seed: 1, shown: [] }, NOW);
    expect(bad.style).not.toBe('custom');
    expect(bad.fallback?.missing).toContain('quads');
    expect(r.fallback).toBeNull();
  });

  it('lists only trained groups as limited', () => {
    const r = generatePlanV2(dataFor({ ...GOLDEN.beginner2, equipment: ['bodyweight'] }), { style: 'auto', seed: 1, shown: [] }, NOW);
    for (const g of r.limited) expect(r.targets.sets[g], g).toBeGreaterThan(0);
    expect(r.limited).not.toContain('front-delts');
  });

  it('feeds focus muscles before other muscles get their floor on a crowded week', () => {
    // Review finding: male look, 4 days, 60 min gave lats 6 of 12 and upper chest 6 of 8.
    const r = generatePlanV2(dataFor(GOLDEN.maleLook), { style: 'auto', seed: 1, shown: [] }, NOW);
    for (const g of ['lats', 'upper-chest', 'side-delts'] as const) expect(r.achieved[g], g).toBeGreaterThanOrEqual(0.9 * r.targets.sets[g]);
  });

  it('names the split after the style', () => {
    const r = generatePlanV2(dataFor(GOLDEN.ownerPairs5), { style: 'pairs', seed: 1, shown: [] }, NOW);
    expect(r.split.name).toBe('Your plan · Pairs');
    expect(r.split.blurb).toContain('Chest + Biceps');
  });
});
