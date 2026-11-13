import { describe, expect, it } from 'vitest';
import { emptyAppData, getExercise } from '../catalogue';
import { MAX_EXERCISES, isEligible, validateSplit } from '../training';
import type { AppData, FocusArea, Profile } from '../types';
import { generatePlan, maxExercisesPerGroup } from './generate';
import { TEMPLATES, alternativesFor, templateFor } from './template';
import { GROUPS, exerciseGroups, idealTargets, setsPerExercise, weeklyTargets, type Group } from './volume';

const NOW = '2026-11-11T08:00:00.000Z';
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;
const MINUTES = [45, 60, 75, 90] as const;
const FOCI: FocusArea[][] = [[], ['chest'], ['arms'], ['legs'], ['glutes'], ['abs'], ['back', 'shoulders'], ['chest', 'arms', 'abs']];

function data(over: Partial<Profile>): AppData {
  const d = emptyAppData(NOW);
  return { ...d, profile: { ...d.profile, ...over } };
}

const strip = (r: ReturnType<typeof generatePlan>) => r.split.sessions.map((s) => ({ ...s, slots: s.slots.map(({ id: _id, ...rest }) => rest) }));


describe('templates', () => {
  it('maps days to templates and alternatives', () => {
    expect([2, 3, 4, 5, 6].map(templateFor)).toEqual(['full-2', 'full-3', 'ul-4', 'ulppl', 'ppl-6']);
    expect([2, 3, 4, 5, 6].map(alternativesFor)).toEqual([[], ['ul-full'], ['ppl-abs'], ['ppl-ul'], []]);
    for (const t of Object.values(TEMPLATES)) expect(t.name.length).toBeGreaterThan(0);
  });
});

describe('generatePlan invariants', () => {
  for (const days of [2, 3, 4, 5, 6]) {
    for (const experience of EXPERIENCE) {
      for (const sessionMinutes of MINUTES) {
        for (const focus of FOCI) {
          const label = `${days}d ${experience} ${sessionMinutes}min focus[${focus.join(',')}]`;
          it(label, () => {
            const d = data({ daysPerWeek: days, experience, sessionMinutes, focus });
            const p = d.profile;
            const tid = templateFor(days);
            const r = generatePlan(d, tid, NOW);
            const spe = setsPerExercise(p);
            const limit = MAX_EXERCISES[sessionMinutes];

            expect(validateSplit(r.split)).toBeNull();
            expect(r.split.sessions).toHaveLength(TEMPLATES[tid].days.length);
            for (const s of r.split.sessions) {
              expect(s.slots.length).toBeGreaterThanOrEqual(1);
              expect(s.slots.length).toBeLessThanOrEqual(limit);
              const firsts = s.slots.map((x) => x.candidates[0]);
              expect(new Set(firsts).size).toBe(firsts.length);
              for (const id of s.slots.flatMap((x) => x.candidates)) {
                const ex = getExercise(id, d.customExercises);
                expect(isEligible(ex, d)).toBe(true);
                expect(ex!.calisthenics).toBeFalsy();
              }
              // Exercises per group per day stay under the session cap (about 8 sets).
              const perGroup: Partial<Record<Group, number>> = {};
              for (const slot of s.slots) {
                const ex = getExercise(slot.candidates[0], [])!;
                for (const [g, w] of Object.entries(exerciseGroups(ex))) if (w === 1) perGroup[g as Group] = (perGroup[g as Group] ?? 0) + 1;
              }
              for (const v of Object.values(perGroup)) expect(v).toBeLessThanOrEqual(maxExercisesPerGroup(p));
              expect(maxExercisesPerGroup(p) * spe).toBeLessThanOrEqual(9);
              // Anchors first; core last except on an abs day.
              const roles = s.slots.map((x) => x.role);
              expect(roles.indexOf('accessory') === -1 || roles.lastIndexOf('anchor') < roles.indexOf('accessory')).toBe(true);
            }

            const targets = r.targets;
            for (const g of GROUPS) expect(targets.sets[g]).toBeLessThanOrEqual(weeklyTargets(p).sets[g]);
            // Main lifts carry fewer sets than the budget assumes, so 'ample' needs 10% headroom.
            const ample = targets.budget >= 1.1 * GROUPS.reduce((a, g) => a + targets.sets[g], 0);
            if (ample) {
              for (const g of GROUPS) {
                expect(r.achieved[g], g).toBeGreaterThanOrEqual(targets.sets[g] - spe);
                // Twice a week unless every day is already full.
                const room = r.split.sessions.some((s) => s.slots.length < limit);
                if (room) expect(r.daysHit[g], g).toBeGreaterThanOrEqual(2);
              }
            }
            // Focus groups are served first, so they are never the ones left short.
            for (const f of targets.focus) expect(r.short).not.toContain(f);
            // Filling spare time never buries the focus under extra non-focus work.
            const ideal = idealTargets(p);
            for (const g of GROUPS) if (!targets.focus.has(g)) expect(r.achieved[g], `${g} (non-focus)`).toBeLessThanOrEqual(Math.max(20, ideal[g] * 1.5));
          });
        }
      }
    }
  }
});

describe('generatePlan', () => {
  it('puts core last on normal days', () => {
    const r = generatePlan(data({ daysPerWeek: 3, sessionMinutes: 90 }), 'full-3', NOW);
    for (const s of r.split.sessions) {
      const core = s.slots.map((x) => x.pattern === 'core');
      const first = core.indexOf(true);
      if (first !== -1) expect(core.slice(first).every(Boolean)).toBe(true);
    }
  });

  it('starts an abs day with core, then focus work', () => {
    const r = generatePlan(data({ daysPerWeek: 4, sessionMinutes: 60, focus: ['chest'] }), 'ppl-abs', NOW);
    const abs = r.split.sessions[3];
    expect(abs.title).toBe('Abs & focus');
    expect(abs.slots.slice(0, 2).every((x) => x.pattern === 'core')).toBe(true);
    expect(abs.slots.some((x) => x.pattern === 'hpush')).toBe(true);
  });

  it('is deterministic', () => {
    const d = data({ daysPerWeek: 4, focus: ['glutes'] });
    expect(strip(generatePlan(d, 'ul-4', NOW))).toEqual(strip(generatePlan(d, 'ul-4', NOW)));
  });

  it('names the plan after its template', () => {
    expect(generatePlan(data({ daysPerWeek: 4 }), 'ul-4', NOW).split.name).toBe('Your plan · Upper / Lower');
  });

  it('reports a shortfall instead of failing when time is short', () => {
    const r = generatePlan(data({ daysPerWeek: 2, sessionMinutes: 45, focus: ['chest'] }), 'full-2', NOW);
    expect(r.short.length).toBeGreaterThan(0);
    expect(r.short).not.toContain('chest');
  });

  it('skips groups the equipment cannot train and never leaves a day empty', () => {
    const r = generatePlan(data({ daysPerWeek: 4, equipment: ['bodyweight'] }), 'ul-4', NOW);
    expect(r.limited).toContain('calves');
    for (const s of r.split.sessions) expect(s.slots.length).toBeGreaterThan(0);
    expect(validateSplit(r.split)).toBeNull();
  });
});
