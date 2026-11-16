import { describe, expect, it } from 'vitest';
import { greeting, heldSeconds, restAlertDelays, shouldAnnounce, shouldGreet } from './alerts';

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

describe('hold timer', () => {
  it('counts whole seconds held, never negative', () => {
    expect(heldSeconds(1_000, 46_900)).toBe(45);
    expect(heldSeconds(5_000, 1_000)).toBe(0);
  });
});

describe('what is new', () => {
  it('announces once per version, and not on a first install', () => {
    expect(shouldAnnounce(null, '4.1.0', false)).toBe(false);
    expect(shouldAnnounce(null, '4.1.0', true)).toBe(true);
    expect(shouldAnnounce('4.0.0', '4.1.0', true)).toBe(true);
    expect(shouldAnnounce('4.1.0', '4.1.0', true)).toBe(false);
  });
});