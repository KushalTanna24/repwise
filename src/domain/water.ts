import dayjs from 'dayjs';
import type { AppData } from './types';

export const GLASS_ML = 250;

/** One tap = one glass. Negative delta undoes; never below zero. */
export function addWater(data: AppData, date: string, delta: number): AppData {
  const next = Math.max(0, (data.water[date] ?? 0) + delta);
  return { ...data, water: { ...data.water, [date]: next } };
}

/** Last 7 days ending on `today` (local YYYY-MM-DD). */
export function waterWeek(data: AppData, today: string) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = dayjs(today).subtract(6 - i, 'day').format('YYYY-MM-DD');
    return { date, glasses: data.water[date] ?? 0 };
  });
  const total = days.reduce((n, d) => n + d.glasses, 0);
  return { days, avg: +(total / 7).toFixed(1), daysHit: days.filter((d) => d.glasses >= data.profile.waterGoal).length };
}

export interface ReminderWindow {
  from: number;
  to: number;
}

/** Hours are local. Reminders are off until the user turns them on. */
export const DEFAULT_WATER_REMINDERS = { on: false, from: 9, to: 21, everyHours: 2 };

/**
 * Glasses expected by `nowMinutes` (local minutes since midnight) if the goal is spread evenly across the window.
 * Pure and dependency-free: the edge function carries a copy.
 */
export function waterPace(glasses: number, goal: number, nowMinutes: number, window: ReminderWindow): { expected: number; behind: number; inWindow: boolean } {
  const { from, to } = window;
  if (to <= from || goal <= 0 || nowMinutes < from * 60 || nowMinutes > to * 60) return { expected: 0, behind: 0, inWindow: false };
  const raw = Math.ceil((goal * (nowMinutes - from * 60)) / ((to - from) * 60));
  const expected = Math.min(goal, Math.max(0, raw));
  return { expected, behind: Math.max(0, expected - glasses), inWindow: true };
}
