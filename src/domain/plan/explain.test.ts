import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { FocusArea, Profile } from '../types';
import { explain } from './explain';
import { generatePlan } from './generate';
import { templateFor } from './template';

const NOW = '2026-11-11T08:00:00.000Z';

function run(over: Partial<Profile>, bmi: number | null = 22) {
  const d = emptyAppData(NOW);
  d.profile = { ...d.profile, ...over };
  const r = generatePlan(d, templateFor(d.profile.daysPerWeek), NOW);
  return explain(r, d.profile, bmi);
}

describe('explain', () => {
  it('leads with each focus group', () => {
    const lines = run({ daysPerWeek: 4, focus: ['chest'] });
    expect(lines[0]).toMatch(/^Chest: \d+ sets a week across \d days \(focus\)\.$/);
    expect(lines[1]).toMatch(/^Other muscles: \d+ to \d+ sets a week/);
  });

  it('explains visible abs when abs is a focus and BMI is 25 or more', () => {
    const line = 'Abs show when body fat is low. Your calorie target does more for them than an extra abs day.';
    expect(run({ daysPerWeek: 4, focus: ['abs'] }, 27)).toContain(line);
    expect(run({ daysPerWeek: 4, focus: ['abs'] }, 22)).not.toContain(line);
    expect(run({ daysPerWeek: 4, focus: ['chest'] }, 27)).not.toContain(line);
  });

  it('reassures beginners', () => {
    expect(run({ daysPerWeek: 3, experience: 'beginner' })).toContain('Beginners grow on less. Volume rises as you progress.');
  });

  it('names groups that are short on time', () => {
    const line = run({ daysPerWeek: 2, sessionMinutes: 45, focus: ['legs'] }).find((l) => l.startsWith('Short on time:'));
    expect(line).toBeDefined();
    expect(line!.endsWith('Add a day or longer sessions.')).toBe(true);
    expect(line).toMatch(/abs/i);
  });

  it('names groups the equipment cannot train', () => {
    const line = run({ daysPerWeek: 4, equipment: ['bodyweight'] }).find((l) => l.startsWith('Limited equipment:'));
    expect(line).toMatch(/calves/i);
  });

  it('never gives more than 6 lines', () => {
    const many: FocusArea[] = ['chest', 'arms', 'legs'];
    for (const days of [2, 3, 4, 5, 6]) {
      for (const experience of ['beginner', 'intermediate'] as const) {
        expect(run({ daysPerWeek: days, experience, focus: many, equipment: ['bodyweight'] }, 31).length).toBeLessThanOrEqual(6);
      }
    }
  });

  it('folds more than three focus groups into one line', () => {
    const lines = run({ daysPerWeek: 6, focus: ['arms', 'legs'] });
    expect(lines[0]).toMatch(/^Focus muscles: /);
    expect(lines[0]).toMatch(/Biceps \d+/);
  });
});
