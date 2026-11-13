import { describe, expect, it } from 'vitest';
import { decideStreak } from './decideStreak.ts';

// 20:10 in Kolkata is 14:40 UTC.
const AT_2010 = new Date('2026-10-27T14:40:00Z');
const AT_1950 = new Date('2026-10-27T14:20:00Z');
const TZ = 'Asia/Kolkata';
const doc = (hint: unknown, profile: Record<string, unknown> = {}) => ({ profile, streakHint: hint });

describe('decideStreak', () => {
  it('nudges at 8 pm when today is not lit and the streak is 3+', () => {
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc({ date: '2026-10-27', current: 5, lit: false }) })).toEqual({
      send: true,
      title: '5-day streak',
      body: 'Your 5-day streak ends at midnight. One goal keeps it alive.',
      url: '/#/today',
      topic: 'streak',
    });
  });

  it('only in the 8 pm hour', () => {
    expect(decideStreak({ now: AT_1950, tz: TZ, doc: doc({ date: '2026-10-27', current: 5, lit: false }) }).send).toBe(false);
  });

  it('not for short streaks, a lit day, or when switched off', () => {
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc({ date: '2026-10-27', current: 2, lit: false }) }).send).toBe(false);
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc({ date: '2026-10-27', current: 5, lit: true }) }).send).toBe(false);
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc({ date: '2026-10-27', current: 5, lit: false }, { streakReminder: false }) }).send).toBe(false);
  });

  it("a hint from yesterday counts only if yesterday was lit (the app wasn't opened today)", () => {
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc({ date: '2026-10-26', current: 5, lit: true }) }).send).toBe(true);
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc({ date: '2026-10-26', current: 5, lit: false }) }).send).toBe(false);
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc({ date: '2026-10-20', current: 5, lit: true }) }).send).toBe(false);
  });

  it('no hint, no nudge', () => {
    expect(decideStreak({ now: AT_2010, tz: TZ, doc: doc(null) }).send).toBe(false);
  });
});
