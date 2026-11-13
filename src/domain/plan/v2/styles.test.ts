import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../../catalogue';
import type { Profile } from '../../types';
import { NOW } from './fixtures';
import { GROUPS } from './groups';
import { STYLE_NAME, eligibleStyles, frequency, pickStyle, styleLayout, validateCustomPairs } from './styles';
import { weeklyTargets } from './targets';

const targetsFor = (o: Partial<Profile>) => weeklyTargets({ ...emptyAppData(NOW).profile, ...o } as Profile, null);

describe('styles', () => {
  it('lists eligible styles by day count', () => {
    expect(eligibleStyles(2)).toEqual(['full', 'custom']);
    expect(eligibleStyles(3)).toEqual(['full', 'upper-lower', 'ppl', 'arnold', 'custom']);
    expect(eligibleStyles(4)).toEqual(['upper-lower', 'hybrid-ppl', 'pairs', 'custom']);
    expect(eligibleStyles(5)).toEqual(['hybrid-ppl', 'pairs', 'bro', 'custom']);
    expect(eligibleStyles(6)).toEqual(['ppl', 'arnold', 'pairs', 'bro', 'custom']);
  });

  it("builds the owner's pairs split", () => {
    expect(styleLayout('pairs', 4).map((d) => d.title)).toEqual(['Chest + Biceps', 'Back + Triceps', 'Shoulders + Legs', 'Cardio + Abs']);
    expect(styleLayout('pairs', 4)[3]).toMatchObject({ groups: ['abs'], cardio: true });
    expect(styleLayout('pairs', 5).map((d) => d.title)).toEqual(['Chest + Biceps', 'Back + Triceps', 'Shoulders', 'Legs', 'Cardio + Abs']);
    expect(styleLayout('pairs', 6)).toHaveLength(5);
  });

  it('builds day counts that match the style', () => {
    expect(styleLayout('upper-lower', 3).map((d) => d.title)).toEqual(['Upper', 'Lower', 'Full Body']);
    expect(styleLayout('hybrid-ppl', 4).map((d) => d.title)).toEqual(['Push', 'Pull', 'Legs', 'Arms & delts']);
    expect(styleLayout('hybrid-ppl', 5).map((d) => d.title)).toEqual(['Push', 'Pull', 'Legs', 'Upper', 'Lower']);
    expect(styleLayout('arnold', 6)).toHaveLength(6);
    expect(styleLayout('full', 3).map((d) => d.title)).toEqual(['Full Body A', 'Full Body B', 'Full Body C']);
  });

  it('never lists front delts and covers every other group in every style', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      for (const id of eligibleStyles(days).filter((s) => s !== 'custom') as Exclude<ReturnType<typeof eligibleStyles>[number], 'custom'>[]) {
        const layout = styleLayout(id, days);
        const listed = new Set(layout.flatMap((d) => d.groups));
        expect(listed.has('front-delts'), `${id}/${days}`).toBe(false);
        for (const g of GROUPS.filter((x) => x !== 'front-delts')) expect(listed.has(g), `${id}/${days}/${g}`).toBe(true);
      }
    }
  });

  it('computes rotation frequency', () => {
    const f = frequency(styleLayout('pairs', 4), 5);
    expect(f.chest).toBeCloseTo(1.25);
    expect(f.abs).toBeCloseTo(1.25);
    expect(f['front-delts']).toBe(0);
    expect(frequency(styleLayout('upper-lower', 4), 4).lats).toBe(2);
  });

  it('auto-picks a style that hits focus groups 1.5x a week', () => {
    expect(pickStyle(4, targetsFor({ focus: ['side-delts', 'lats'], daysPerWeek: 4 }))).toBe('upper-lower');
  });

  it('names every style', () => {
    expect(STYLE_NAME.pairs).toBe('Pairs');
    expect(STYLE_NAME.custom).toBe('Custom pairs');
  });

  it('validates custom pairs', () => {
    const t = targetsFor({ daysPerWeek: 4 });
    const r = validateCustomPairs([{ title: 'A', groups: ['chest'] }, { title: 'B', groups: [] }], t, 4);
    expect(r.ok).toBe(false);
    expect(r.emptyDays).toEqual([1]);
    expect(r.missing).toContain('quads');
    expect(r.missing).not.toContain('front-delts');
  });

  it('accepts a cardio-only day and warns on low frequency', () => {
    const t = targetsFor({ daysPerWeek: 4 });
    const days = [...styleLayout('pairs', 4).slice(0, 3), { title: 'Cardio', groups: [], cardio: true }];
    const r = validateCustomPairs(days, t, 4);
    expect(r.emptyDays).toEqual([]);
    expect(r.missing).toEqual(['abs']);
    expect(r.lowFrequency).toContain('chest');
    expect(validateCustomPairs(styleLayout('pairs', 4), t, 4).ok).toBe(true);
  });

  it('rejects fewer than 2 or more than 7 days', () => {
    const t = targetsFor({ daysPerWeek: 4 });
    expect(validateCustomPairs([{ title: 'All', groups: [...GROUPS] }], t, 4).ok).toBe(false);
    expect(validateCustomPairs(Array.from({ length: 8 }, (_, i) => ({ title: `D${i}`, groups: [...GROUPS] })), t, 4).ok).toBe(false);
  });
});
