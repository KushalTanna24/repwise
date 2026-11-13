import { describe, expect, it } from 'vitest';
import { rng } from './rng';

describe('rng', () => {
  it('is deterministic and in range', () => {
    const a = rng(42);
    const b = rng(42);
    const xs = Array.from({ length: 50 }, a);
    expect(Array.from({ length: 50 }, b)).toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(rng(1)()).not.toBe(rng(2)());
  });
});
