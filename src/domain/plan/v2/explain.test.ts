import { describe, expect, it } from 'vitest';
import { explainV2 } from './explain';
import { NOW } from './fixtures';
import { generatePlanV2 } from './generate';
import { GOLDEN, dataFor } from './goldenProfiles';

describe('explainV2', () => {
  it('leads with the style and frequency, then focus lines', () => {
    const d = dataFor(GOLDEN.advanced6);
    const lines = explainV2(generatePlanV2(d, { style: 'ppl', seed: 1, shown: [] }, NOW), d.profile, null);
    expect(lines[0]).toMatch(/^Push \/ Pull \/ Legs\. Each muscle trained about 2 times a week\.$/);
    expect(lines.some((l) => /^Side delts: \d+ sets a week across \d+ days \(focus\)\.$/.test(l))).toBe(true);
    expect(lines.at(-1)).toBe('No training history yet. The plan adapts after a few weeks of logged workouts.');
    expect(lines.length).toBeLessThanOrEqual(7);
  });

  it('warns when a focus muscle is trained about once a week', () => {
    const d = dataFor(GOLDEN.ownerPairs5);
    const lines = explainV2(generatePlanV2(d, { style: 'pairs', seed: 1, shown: [] }, NOW), d.profile, null);
    expect(lines[1]).toMatch(/^Upper chest, chest, biceps and triceps trained about 1 time a week. Fine for holding, slower for growing./);
  });

  it('adds the look line with the body-fat estimate', () => {
    const d = dataFor(GOLDEN.maleLook);
    const lines = explainV2(generatePlanV2(d, { style: 'auto', seed: 1, shown: [] }, NOW), d.profile, { pct: 19, method: 'rough' });
    expect(lines.some((l) => /^V-taper: side delts \d+ sets and lats \d+ sets lead the week\. Body fat ~19% \(rough\), aim 10–15%\.$/.test(l))).toBe(true);
  });

  it('says maintaining is the healthy choice at or under the floor', () => {
    const d = dataFor(GOLDEN.maleLook);
    const lines = explainV2(generatePlanV2(d, { style: 'auto', seed: 1, shown: [] }, NOW), d.profile, { pct: 7, method: 'navy' });
    expect(lines).toContain('Body fat ~7% (tape) is at the healthy floor for men. Maintaining is the healthy choice, so calories stay at maintenance.');
    expect(lines.some((l) => l.startsWith('V-taper:'))).toBe(false);
  });

  it('adds the calorie clause on a cut', () => {
    const d = dataFor({ ...GOLDEN.maleLook, bodyGoal: 'lose' });
    const lines = explainV2(generatePlanV2(d, { style: 'auto', seed: 1, shown: [] }, NOW), d.profile, { pct: 19, method: 'navy' }, 350);
    expect(lines.some((l) => l.includes('lead the week. Waist stays tight through a 350 kcal deficit, about 0.3 kg a week. Body fat ~19% (tape), aim 10–15%.'))).toBe(true);
  });

  it('carries history reasons and drops the no-history line', () => {
    const d = dataFor(GOLDEN.cutWithHistory);
    const lines = explainV2(generatePlanV2(d, { style: 'upper-lower', seed: 1, shown: [] }, NOW), d.profile, null);
    expect(lines.some((l) => l.includes('dumbbell lateral raise flat'))).toBe(true);
    expect(lines.some((l) => l.startsWith('No training history yet'))).toBe(false);
  });

  it('says when saved custom pairs could not be used', () => {
    const d = dataFor(GOLDEN.ownerPairs5);
    const r = generatePlanV2(d, { style: 'custom', customPairs: [{ title: 'Chest', groups: ['chest'] }, { title: 'Back', groups: ['lats'] }], seed: 1, shown: [] }, NOW);
    const lines = explainV2(r, d.profile, null);
    expect(lines[1]).toMatch(/^Your custom pairs leave out .+, so Repwise picked .+\. Edit them in the split step\.$/);
  });

  it('names limited groups with an equipment hint', () => {
    const d = dataFor({ ...GOLDEN.beginner2, equipment: ['bodyweight'] });
    const lines = explainV2(generatePlanV2(d, { style: 'auto', seed: 1, shown: [] }, NOW), d.profile, null);
    expect(lines.some((l) => l.startsWith('Limited equipment:') && l.endsWith('Add dumbbells or cable in Profile.'))).toBe(true);
  });
});
