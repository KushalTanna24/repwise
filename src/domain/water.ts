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