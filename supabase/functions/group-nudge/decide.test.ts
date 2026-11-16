import { describe, expect, it } from 'vitest';
import { decideGroupNudge, localDayStartIso } from './decide.ts';

const KOL = 'Asia/Kolkata';
// 15:00 in Kolkata.
const AFTERNOON = new Date('2026-11-13T09:30:00Z');
const doc = (over: Record<string, unknown> = {}) => ({ profile: { waterReminders: { on: false, from: 9, to: 21, everyHours: 2 } }, sessions: [], leave: [], ...over });

describe('decideGroupNudge', () => {
  it('leave wins', () => {
    const d = doc({ leave: [{ start: '2026-11-10', end: null }], sessions: [{ startedAt: '2026-11-13T04:00:00Z', finishedAt: '2026-11-13T05:00:00Z' }] });
    expect(decideGroupNudge({ now: AFTERNOON, tz: KOL, doc: d, pushesToday: 0 })).toBe('quiet');
  });

  it('already trained today gives a cheer, even inside the window', () => {
    const d = doc({ sessions: [{ startedAt: '2026-11-13T03:00:00Z', finishedAt: '2026-11-13T04:00:00Z' }] });
    expect(decideGroupNudge({ now: AFTERNOON, tz: KOL, doc: d, pushesToday: 0 })).toBe('cheer');
  });

  it('a workout finished yesterday local time is not today', () => {
    // 18:00 UTC on the 12th is 23:30 on the 12th in Kolkata.
    const d = doc({ sessions: [{ startedAt: '2026-11-12T17:00:00Z', finishedAt: '2026-11-12T18:00:00Z' }] });
    expect(decideGroupNudge({ now: AFTERNOON, tz: KOL, doc: d, pushesToday: 0 })).toBe('push');
  });

  it('outside the default window is quiet', () => {
    // 21:30 in Kolkata.
    expect(decideGroupNudge({ now: new Date('2026-11-13T16:00:00Z'), tz: KOL, doc: doc(), pushesToday: 0 })).toBe('quiet');
  });

  it('uses the water window when water reminders are on', () => {
    const d = doc({ profile: { waterReminders: { on: true, from: 10, to: 22, everyHours: 2 } } });
    // 09:00 in Kolkata: inside the default window, before the water window.
    expect(decideGroupNudge({ now: new Date('2026-11-13T03:30:00Z'), tz: KOL, doc: d, pushesToday: 0 })).toBe('quiet');
    // 21:30: after the default window, inside the water window.
    expect(decideGroupNudge({ now: new Date('2026-11-13T16:00:00Z'), tz: KOL, doc: d, pushesToday: 0 })).toBe('push');
  });

  it('the third push today is capped', () => {
    expect(decideGroupNudge({ now: AFTERNOON, tz: KOL, doc: doc(), pushesToday: 2 })).toBe('capped');
  });

  it('otherwise push', () => {
    expect(decideGroupNudge({ now: AFTERNOON, tz: KOL, doc: doc(), pushesToday: 1 })).toBe('push');
  });

  it('rule order: cheer beats quiet', () => {
    const d = doc({ sessions: [{ startedAt: '2026-11-13T14:00:00Z', finishedAt: '2026-11-13T15:00:00Z' }] });
    expect(decideGroupNudge({ now: new Date('2026-11-13T16:00:00Z'), tz: KOL, doc: d, pushesToday: 0 })).toBe('cheer');
  });

  it("follows the receiver's time zone", () => {
    expect(decideGroupNudge({ now: new Date('2026-11-13T02:00:00Z'), tz: KOL, doc: doc(), pushesToday: 0 })).toBe('quiet'); // 07:30
    expect(decideGroupNudge({ now: new Date('2026-11-13T03:00:00Z'), tz: KOL, doc: doc(), pushesToday: 0 })).toBe('push'); // 08:30
  });

  it('a missing or junk doc still decides by the clock', () => {
    expect(decideGroupNudge({ now: AFTERNOON, tz: KOL, doc: null, pushesToday: 0 })).toBe('push');
    expect(decideGroupNudge({ now: AFTERNOON, tz: 'Not/AZone', doc: doc(), pushesToday: 0 })).toBe('push');
  });
});

describe('localDayStartIso', () => {
  it('is local midnight as a UTC instant', () => {
    expect(localDayStartIso(new Date('2026-11-13T09:30:12.345Z'), KOL)).toBe('2026-11-12T18:30:00.000Z');
    expect(localDayStartIso(new Date('2026-11-13T09:30:00Z'), 'UTC')).toBe('2026-11-13T00:00:00.000Z');
  });
});
