import { describe, expect, it } from 'vitest';
import { BUILT_IN_SPLITS } from './splits/builtins';
import { weekSummary, weekView } from './week';

const hybrid = BUILT_IN_SPLITS['ppl-hybrid'];
const bro = { ...hybrid, sessions: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'].map((title) => ({ title, slots: [] })) };

describe('weekView', () => {
  it('fills a 6-day week from a 3-day rotation, each day twice', () => {
    const w = weekView(hybrid, 6, { sessionIndex: 0, cycle: 1 });
    expect(w.map((d) => d.title)).toEqual(['Chest & Biceps', 'Back & Triceps', 'Legs & Shoulders', 'Chest & Biceps', 'Back & Triceps', 'Legs & Shoulders']);
    expect(w.map((d) => d.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('places the second round of the rotation later in the same week', () => {
    // Cycle 2 day 1 is the fourth session of a 6-day week.
    const w = weekView(hybrid, 6, { sessionIndex: 0, cycle: 2 });
    expect(w.map((d) => d.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(w[3].sessionIndex).toBe(0);
  });

  it('starts a new week once the week is used up', () => {
    const w = weekView(hybrid, 6, { sessionIndex: 0, cycle: 3 });
    expect(w[0].state).toBe('current');
  });

  it('shows only part of a long rotation in a short week', () => {
    const w = weekView(bro, 3, { sessionIndex: 3, cycle: 1 });
    expect(w.map((d) => d.title)).toEqual(['Shoulders', 'Arms', 'Chest']);
    expect(w[0].state).toBe('current');
  });

  it('clamps days to 1..7', () => {
    expect(weekView(hybrid, 0, { sessionIndex: 0, cycle: 1 })).toHaveLength(1);
    expect(weekView(hybrid, 12, { sessionIndex: 0, cycle: 1 })).toHaveLength(7);
  });
});

describe('weekSummary', () => {
  it('says how the rotation fits the week', () => {
    expect(weekSummary(3, 3)).toBe('Each day once a week');
    expect(weekSummary(3, 6)).toBe('Each day twice a week. Extras change on the second round');
    expect(weekSummary(2, 6)).toBe('Each day 3 times a week. Extras change each round');
    expect(weekSummary(3, 5)).toBe('5 sessions a week from a 3-day rotation');
    expect(weekSummary(5, 3)).toBe('One full rotation takes about 2 weeks');
    expect(weekSummary(4, 3)).toBe('One full rotation takes about 1.5 weeks');
  });
});
