import dayjs from 'dayjs';
import { firstGoalDate, goalIndex } from './goals';
import { onLeave } from './leave';
import type { AppData } from './types';

export type DayState = 'lit' | 'frozen' | 'leave' | 'missed';
export interface StreakResult {
  current: number;
  best: number;
  freezes: number;
  todayLit: boolean;
  /** Past days and a lit today; a pending today is absent. */
  days: Map<string, DayState>;
  /** Running count after each date, for badges. */
  counts: Map<string, number>;
  freezeUsedOn: string | null;
}

export const FREEZE_EVERY = 7;
export const FREEZE_CAP = 2;

const memo = new WeakMap<AppData, { today: string; result: StreakResult }>();

/** Replays every day from the first lit one; derived, never stored. */
export function streak(data: AppData, today: string): StreakResult {
  const hit = memo.get(data);
  if (hit?.today === today) return hit.result;

  const r: StreakResult = { current: 0, best: 0, freezes: 0, todayLit: false, days: new Map(), counts: new Map(), freezeUsedOn: null };
  const first = firstGoalDate(data);
  if (first && first <= today) {
    const at = goalIndex(data);
    for (let d = dayjs(first); ; d = d.add(1, 'day')) {
      const date = d.format('YYYY-MM-DD');
      if (date > today) break;
      const lit = at(date).some((g) => g.status.done);
      if (lit) {
        r.current++;
        if (r.current % FREEZE_EVERY === 0) r.freezes = Math.min(FREEZE_CAP, r.freezes + 1);
        r.days.set(date, 'lit');
        if (date === today) r.todayLit = true;
      } else if (date === today) {
        break;
      } else if (onLeave(data, date)) {
        r.days.set(date, 'leave');
      } else if (r.freezes > 0) {
        r.freezes--;
        r.freezeUsedOn = date;
        r.days.set(date, 'frozen');
      } else {
        r.current = 0;
        r.days.set(date, 'missed');
      }
      r.best = Math.max(r.best, r.current);
      r.counts.set(date, r.current);
    }
  }
  memo.set(data, { today, result: r });
  return r;
}

/** Cache for the server's streak nudge; the app never reads it. */
export function withStreakHint(data: AppData, today: string): AppData {
  const s = streak(data, today);
  return { ...data, streakHint: { date: today, current: s.current, lit: s.todayLit } };
}
