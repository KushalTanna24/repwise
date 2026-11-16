import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { emptyAppData } from './catalogue';
import { earnedBadges, markBadgesSeen, unseenBadges, withBadgeBackfill } from './badges';
import { endFast, startFast } from './fasting';
import type { AppData, WorkoutSession } from './types';

const TODAY = '2026-10-27';
const back = (n: number) => dayjs(TODAY).subtract(n, 'day').format('YYYY-MM-DD');
const base = (): AppData => ({ ...emptyAppData(`${TODAY}T08:00:00`), supplements: [] });
const lit = (d: AppData, n: number): AppData => ({ ...d, water: Object.fromEntries(Array.from({ length: n }, (_, i) => [back(n - i), d.profile.waterGoal])) });
const sess = (id: string, date: string): WorkoutSession => ({ id, planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'A', startedAt: `${date}T07:00:00`, finishedAt: `${date}T08:00:00`, exercises: [] });

describe('badges', () => {
  it('streak badges carry the date the count was reached', () => {
    const e = earnedBadges(lit(base(), 7), TODAY);
    expect(e.get('streak-3')).toBe(back(5));
    expect(e.get('streak-7')).toBe(back(1));
    expect(e.has('streak-30')).toBe(false);
  });

  it('seven water-goal days in a row earn hydrated-week', () => {
    expect(earnedBadges(lit(base(), 7), TODAY).get('hydrated-week')).toBe(back(1));
    expect(earnedBadges(lit(base(), 6), TODAY).has('hydrated-week')).toBe(false);
  });

  it('the first finished session earns first-workout', () => {
    expect(earnedBadges({ ...base(), sessions: [sess('b', back(2)), sess('a', back(4))] }, TODAY).get('first-workout')).toBe(back(4));
  });

  it('a finished 75-Day run earns finish-75 on its end date', () => {
    const run = { id: 'r', templateId: '75-day' as const, title: '75-Day Challenge', startDate: '2026-08-01', days: 75, rule: 'strict' as const, tasks: [], ticks: {}, status: 'done' as const, restarts: 0, endedOn: back(3) };
    const e = earnedBadges({ ...base(), challenges: [run] }, TODAY);
    expect(e.get('finish-75')).toBe(back(3));
    expect(e.has('finish-stack')).toBe(false);
  });

  it('a 24.5h fast earns fast-24 but not fast-36', () => {
    const d = endFast(startFast(base(), 24, `${back(2)}T08:00:00`, 'f'), `${back(1)}T08:30:00`);
    const e = earnedBadges(d, TODAY);
    expect(e.get('fast-24')).toBe(back(1));
    expect(e.has('fast-36')).toBe(false);
  });

  it('unseen excludes celebrated badges; marking adds them', () => {
    const d = lit(base(), 3);
    expect(unseenBadges(d, TODAY)).toEqual(['streak-3']);
    expect(unseenBadges(markBadgesSeen(d, ['streak-3']), TODAY)).toEqual([]);
  });

  it('existing users get earned badges silently; new users keep an empty list', () => {
    const old = { ...lit(base(), 3), seenBadges: undefined };
    expect(withBadgeBackfill(old, TODAY).seenBadges).toEqual(['streak-3']);
    const fresh = lit(base(), 3);
    expect(withBadgeBackfill(fresh, TODAY)).toBe(fresh);
  });
});
