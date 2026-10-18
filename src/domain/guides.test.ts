import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from './catalogue';
import { GUIDES, demoUrl } from './guides';

describe('exercise guides', () => {
  it('every built-in exercise has a complete guide', () => {
    for (const e of BUILTIN_EXERCISES) {
      const g = GUIDES[e.id];
      expect(g, e.id).toBeDefined();
      expect(g.setup.length, `${e.id} setup`).toBeGreaterThan(10);
      expect(g.steps.length, `${e.id} steps`).toBeGreaterThanOrEqual(3);
      expect(g.cues.length, `${e.id} cues`).toBeGreaterThanOrEqual(2);
      expect(g.mistakes.length, `${e.id} mistakes`).toBeGreaterThanOrEqual(2);
    }
  });

  it('has no guides for unknown ids', () => {
    const ids = new Set(BUILTIN_EXERCISES.map((e) => e.id));
    expect(Object.keys(GUIDES).filter((k) => !ids.has(k))).toEqual([]);
  });

  it('demo link is a YouTube search for proper form', () => {
    expect(demoUrl('Back squat')).toBe('https://www.youtube.com/results?search_query=Back%20squat%20proper%20form');
  });
});
