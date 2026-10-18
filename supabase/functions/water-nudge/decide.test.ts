import { describe, expect, it } from 'vitest';
import { waterPace as appPace } from '../../../src/domain/water.ts';
import { waterPace as fnPace } from './pace.ts';
import { decideNudge, localClock } from './decide.ts';

const doc = (over: { on?: boolean; from?: number; to?: number; everyHours?: number; goal?: number; water?: Record<string, number> } = {}) => ({
  profile: {
    waterGoal: over.goal ?? 8,
    waterReminders: { on: over.on ?? true, from: over.from ?? 9, to: over.to ?? 21, everyHours: over.everyHours ?? 2 },
  },
  water: over.water ?? {},
});

// 15:00 in Kolkata (UTC+5:30)
const AT_15 = new Date('2026-10-18T09:30:00Z');
const base = { now: AT_15, tz: 'Asia/Kolkata', lastSentAt: null as string | null };

describe('localClock', () => {
  it('gives the local date and minutes', () => {
    expect(localClock(AT_15, 'Asia/Kolkata')).toEqual({ date: '2026-10-18', minutes: 900 });
  });
  it('rolls the date with the zone', () => {
    expect(localClock(new Date('2026-10-18T20:00:00Z'), 'Asia/Kolkata')).toEqual({ date: '2026-10-19', minutes: 90 });
  });
  it('returns null for a bad zone', () => {
    expect(localClock(AT_15, 'Not/AZone')).toBeNull();
  });
});

describe('decideNudge', () => {
  it('skips when reminders are off', () => {
    expect(decideNudge({ ...base, doc: doc({ on: false }) })).toEqual({ send: false, reason: 'off' });
  });
  it('skips outside the window', () => {
    const now = new Date('2026-10-18T02:30:00Z'); // 08:00 local
    expect(decideNudge({ ...base, now, doc: doc() })).toEqual({ send: false, reason: 'window' });
  });
  it('skips a broken window', () => {
    expect(decideNudge({ ...base, doc: doc({ from: 21, to: 9 }) })).toEqual({ send: false, reason: 'window' });
  });
  it('skips when sent within everyHours', () => {
    const lastSentAt = new Date(AT_15.getTime() - 90 * 60000).toISOString();
    expect(decideNudge({ ...base, lastSentAt, doc: doc() })).toEqual({ send: false, reason: 'recent' });
  });
  it('sends once everyHours has passed, despite cron jitter', () => {
    const lastSentAt = new Date(AT_15.getTime() - (2 * 60 - 1) * 60000).toISOString();
    expect(decideNudge({ ...base, lastSentAt, doc: doc() }).send).toBe(true);
  });
  it('skips when on pace', () => {
    expect(decideNudge({ ...base, doc: doc({ water: { '2026-10-18': 4 } }) })).toEqual({ send: false, reason: 'on-pace' });
  });
  it('sends when behind', () => {
    expect(decideNudge({ ...base, doc: doc({ water: { '2026-10-18': 1 } }) })).toEqual({
      send: true,
      title: 'Time for water',
      body: "1 of 8 glasses. You're 3 behind, have one now.",
      url: '/#/today',
    });
  });
  it('treats a missing day as zero glasses', () => {
    const r = decideNudge({ ...base, doc: doc() });
    expect(r.send && r.body).toBe("0 of 8 glasses. You're 4 behind, have one now.");
  });
  it('rejects a bad zone', () => {
    expect(decideNudge({ ...base, tz: 'Not/AZone', doc: doc() })).toEqual({ send: false, reason: 'bad-tz' });
  });
  it('reports no-data for a missing doc or profile', () => {
    expect(decideNudge({ ...base, doc: null })).toEqual({ send: false, reason: 'no-data' });
    expect(decideNudge({ ...base, doc: {} })).toEqual({ send: false, reason: 'no-data' });
  });
  it('defaults reminders to off', () => {
    expect(decideNudge({ ...base, doc: { profile: { waterGoal: 8 }, water: {} } })).toEqual({ send: false, reason: 'off' });
  });
});

describe('pace parity with the app', () => {
  for (const win of [{ from: 9, to: 21 }, { from: 6, to: 23 }]) {
    it(`matches for window ${win.from}-${win.to}`, () => {
      for (let goal = 0; goal <= 12; goal++)
        for (let glasses = 0; glasses <= 12; glasses++)
          for (let h = 0; h <= 23; h++)
            expect(fnPace(glasses, goal, h * 60, win)).toEqual(appPace(glasses, goal, h * 60, win));
    });
  }
});
