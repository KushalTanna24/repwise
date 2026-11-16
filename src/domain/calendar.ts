import dayjs from 'dayjs';
import type { AppData } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addGoal(data: AppData, title: string, date: string): AppData {
  const clean = title.trim();
  if (!clean || !ISO_DATE.test(date) || !dayjs(date).isValid()) return data;
  const goal = { id: `goal-${date}-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${data.goals.length}`, title: clean, date };
  return { ...data, goals: [...data.goals, goal].sort((a, b) => a.date.localeCompare(b.date)) };
}

export const removeGoal = (data: AppData, id: string): AppData => ({ ...data, goals: data.goals.filter((g) => g.id !== id) });

/** The closest goal on or after today, with days remaining. */
export function nextGoal(data: AppData, today: string) {
  const g = data.goals.find((x) => x.date >= today);
  return g ? { ...g, daysLeft: dayjs(g.date).diff(dayjs(today), 'day') } : null;
}

/** Six Monday-first weeks covering the month (`YYYY-MM`). */
export function monthCells(month: string) {
  const first = dayjs(`${month}-01`);
  const start = first.subtract((first.day() + 6) % 7, 'day');
  return Array.from({ length: 42 }, (_, i) => {
    const d = start.add(i, 'day');
    return { date: d.format('YYYY-MM-DD'), inMonth: d.month() === first.month() };
  });
}

/** What happened on a day, for the calendar dots. */
/** Titles of user goals (deadlines) that fall on a date. */
export const deadlinesOn = (data: AppData, date: string) => data.goals.filter((g) => g.date === date).map((g) => g.title);
