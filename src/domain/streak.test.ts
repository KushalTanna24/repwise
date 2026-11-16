import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { emptyAppData } from './catalogue';
import { deleteHistorySession } from './session';
import { streak, withStreakHint } from './streak';
import { startChallenge } from './challenges';
import { seventyFiveDraft } from './challengeTemplates';
import type { AppData, WorkoutSession } from './types';

const TODAY = '2026-10-27';
const back = (n: number) => dayjs(TODAY).subtract(n, 'day').format('YYYY-MM-DD');
const base = (): AppData => ({ ...emptyAppData(`${TODAY}T08:00:00`), supplements: [] });
/** Water at goal on each date given (days back from today). */
const lit = (d: AppData, daysBack: number[]): AppData => ({ ...d, water: { ...d.water, ...Object.fromEntries(daysBack.map((n) => [back(n), d.profile.waterGoal])) } });
const range = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => from - i);

describe('streak', () => {
  it('no data: nothing to show', () => {
    expect(streak(base(), TODAY)).toMatchObject({ current: 0, best: 0, freezes: 0, todayLit: false });
  });

  it('an unlit today never breaks the streak', () => {
    const s = streak(lit(base(), range(5, 1)), TODAY);
    expect(s).toMatchObject({ current: 5, todayLit: false, freezes: 0 });
    expect(s.days.has(TODAY)).toBe(false);
  });

  it('a lit today counts', () => {
    expect(streak(lit(base(), range(5, 0)), TODAY)).toMatchObject({ current: 6, todayLit: true });
  });

  it('7 lit days earn a freeze, held up to 2', () => {
    expect(streak(lit(base(), range(7, 1)), TODAY).freezes).toBe(1);
    expect(streak(lit(base(), range(21, 1)), TODAY).freezes).toBe(2);
  });

  it('a miss spends a freeze: streak survives without growing', () => {
    const s = streak(lit(base(), [...range(10, 4), 2, 1]), TODAY);
    expect(s).toMatchObject({ current: 9, freezes: 0, freezeUsedOn: back(3) });
    expect(s.days.get(back(3))).toBe('frozen');
  });

  it('a miss without a freeze resets', () => {
    const s = streak(lit(base(), [6, 5, 4, 2, 1]), TODAY);
    expect(s).toMatchObject({ current: 2, best: 3, freezeUsedOn: null });
    expect(s.days.get(back(3))).toBe('missed');
  });

  it('leave neither adds nor breaks', () => {
    const d = { ...lit(base(), [6, 5, 4, 2, 1]), leave: [{ start: back(3), end: back(3) }] };
    const s = streak(d, TODAY);
    expect(s).toMatchObject({ current: 5, freezes: 0 });
    expect(s.days.get(back(3))).toBe('leave');
  });

  it('counts records the running count per date', () => {
    expect(streak(lit(base(), range(3, 1)), TODAY).counts.get(back(1))).toBe(3);
  });

  it('deleting the only workout of a past day recomputes', () => {
    const s: WorkoutSession = { id: 's', planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'A', startedAt: `${back(3)}T07:00:00`, finishedAt: `${back(3)}T08:00:00`, exercises: [] };
    const d = { ...lit(base(), [6, 5, 4, 2, 1]), sessions: [s] };
    expect(streak(d, TODAY).current).toBe(6);
    const after = streak(deleteHistorySession(d, 's'), TODAY);
    expect(after.current).toBe(2);
    expect(after.days.get(back(3))).toBe('missed');
  });

  it('withStreakHint writes today, count and lit', () => {
    expect(withStreakHint(lit(base(), range(3, 1)), TODAY).streakHint).toEqual({ date: TODAY, current: 3, lit: false });
  });
});

describe('streak cost', () => {
  it('the hinted object reuses the replay', () => {
    const d = lit(base(), range(5, 1));
    const hinted = withStreakHint(d, TODAY);
    expect(streak(hinted, TODAY)).toBe(streak(d, TODAY));
  });

  it('two years with three 75-day runs replays within budget', () => {
    let d = base();
    const days = Array.from({ length: 700 }, (_, i) => back(i));
    d = {
      ...d,
      water: Object.fromEntries(days.map((x) => [x, d.profile.waterGoal])),
      sessions: days.filter((_, i) => i % 2 === 0).map((x) => ({ id: x, planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'A', startedAt: `${x}T07:00:00`, finishedAt: `${x}T08:00:00`, exercises: [] })),
    };
    for (const id of ['a', 'b', 'c']) d = startChallenge(d, seventyFiveDraft(), back(60), id);
    streak({ ...d }, TODAY); // warm up
    const t = performance.now();
    streak({ ...d }, TODAY);
    expect(performance.now() - t).toBeLessThan(60);
  });
});
