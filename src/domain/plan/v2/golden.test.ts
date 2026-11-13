import { describe, expect, it } from 'vitest';
import { getExercise } from '../../catalogue';
import { prescription, validateSplit, type CustomSplit } from '../../training';
import type { AppData } from '../../types';
import { generatePlan } from '../generate';
import { templateFor } from '../template';
import { allocate } from './allocate';
import { metaFor } from './exerciseMeta';
import { NOW } from './fixtures';
import { GOLDEN, dataFor } from './goldenProfiles';
import { generatePlanV2, type PlanResultV2 } from './generate';
import { GROUPS, type Group } from './groups';
import { readHistory } from './history';
import { planDistance, scorePlan } from './score';
import { makeCtx, type Candidate } from './select';

const strip = (r: PlanResultV2) => r.split.sessions.map((s) => ({ ...s, slots: s.slots.map(({ id: _id, ...rest }) => rest) }));

/** Re-reads a v1 split with v2's credits, so both generators are scored the same way. */
function toCandidate(split: CustomSplit, data: AppData): Candidate {
  const p = data.profile;
  const scale = p.daysPerWeek / split.sessions.length;
  const achieved = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  const daysHit = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  for (const s of split.sessions) {
    const touched = new Set<Group>();
    for (const slot of s.slots) {
      const ex = getExercise(slot.candidates[0], data.customExercises)!;
      const m = metaFor(ex);
      const sets = prescription(p, slot.role, ex, p.sessionMinutes).sets;
      for (const [g, w] of Object.entries(m.muscles) as [Group, number][]) {
        achieved[g] += sets * w * scale;
        touched.add(g);
      }
    }
    for (const g of touched) daysHit[g] += 1;
  }
  return { sessions: split.sessions, picks: split.sessions.map((s) => s.slots.map((x) => x.candidates[0])), achieved, daysHit };
}

for (const [name, g] of Object.entries(GOLDEN)) {
  describe(`golden: ${name}`, () => {
    const d = dataFor(g);
    it('holds the invariants across 4 regenerate steps', () => {
      let shown: string[][][] = [];
      for (let step = 0; step < 4; step++) {
        const r = generatePlanV2(d, { style: g.style, seed: 1, shown }, NOW);
        for (const grp of GROUPS) if (r.targets.sets[grp] > 0 && !r.limited.includes(grp)) expect(r.daysHit[grp], `${step}/${grp}`).toBeGreaterThan(0);
        for (const grp of r.targets.focus)
          if (!r.limited.includes(grp) && !r.short.includes(grp)) expect(r.achieved[grp], `${step}/${grp}`).toBeGreaterThanOrEqual(0.9 * r.targets.sets[grp]);
        for (const s of r.split.sessions) expect(s.slots.filter((x) => x.pattern !== 'cardio').length).toBeLessThanOrEqual(r.targets.exerciseLimit);
        if (d.profile.planGoal === 'look') expect(r.achieved['side-delts']).toBeGreaterThanOrEqual(8);
        if (!r.exhausted) for (const prev of shown) expect(planDistance(prev, r.picks)).toBeGreaterThanOrEqual(0.4);
        expect(validateSplit(r.split)).toBeNull();
        shown = [...shown, r.picks];
      }
    });

    it('v2 scores at least as well as v1', () => {
      const r = generatePlanV2(d, { style: g.style, seed: 1, shown: [] }, NOW);
      const v1 = generatePlan(d, templateFor(g.daysPerWeek), NOW);
      const ctx = makeCtx(d, r.targets, r.layout, allocate(r.layout, r.targets, g.daysPerWeek), readHistory(d, NOW), NOW);
      expect(r.score).toBeGreaterThanOrEqual(scorePlan(toCandidate(v1.split, d), ctx));
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
    const t0 = performance.now();
    generatePlanV2(d, { style: 'ppl', seed: 2, shown: [] }, NOW);
    expect(performance.now() - t0).toBeLessThan(50);
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
  });

  it('names the split after the style', () => {
    const r = generatePlanV2(dataFor(GOLDEN.ownerPairs5), { style: 'pairs', seed: 1, shown: [] }, NOW);
    expect(r.split.name).toBe('Your plan · Pairs');
    expect(r.split.blurb).toContain('Chest + Biceps');
  });
});
