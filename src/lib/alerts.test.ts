import { describe, expect, it } from 'vitest';
import { greeting, restAlertDelays, shouldGreet } from './alerts';

describe('rest alerts', () => {
  it('fires 10 s before the end and at the end', () => {
    expect(restAlertDelays(100_000, 10_000)).toEqual({ warn: 80_000, done: 90_000 });
  });

  it('skips the warning when less than 10 s remain', () => {
    expect(restAlertDelays(100_000, 95_000)).toEqual({ warn: null, done: 5_000 });
  });

  it('nothing when the rest is already over', () => {
    expect(restAlertDelays(100_000, 120_000)).toEqual({ warn: null, done: null });
  });
});

describe('daily greeting', () => {
  it('greets once per local day', () => {
    expect(shouldGreet(null, '2026-10-17')).toBe(true);
    expect(shouldGreet('2026-10-16', '2026-10-17')).toBe(true);
    expect(shouldGreet('2026-10-17', '2026-10-17')).toBe(false);
  });

  it('picks the greeting by hour', () => {
    expect(greeting(6)).toBe('Good morning');
    expect(greeting(13)).toBe('Good afternoon');
    expect(greeting(19)).toBe('Good evening');
    expect(greeting(2)).toBe('Late one');
  });
});
