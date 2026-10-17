import dayjs from 'dayjs';
import type { AppData, Supplement } from './types';

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const activeSupplements = (data: AppData): Supplement[] => data.supplements.filter((s) => !s.archived);

export function addSupplement(data: AppData, name: string, dose?: string): AppData {
  const clean = name.trim();
  if (!clean) return data;
  const root = slug(clean) || 'supplement';
  let id = root;
  for (let n = 2; data.supplements.some((s) => s.id === id); n++) id = `${root}-${n}`;
  return { ...data, supplements: [...data.supplements, { id, name: clean, ...(dose?.trim() ? { dose: dose.trim() } : {}) }] };
}

export function renameSupplement(data: AppData, id: string, name: string): AppData {
  if (!name.trim()) return data;
  return { ...data, supplements: data.supplements.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)) };
}

/** Archived supplements leave the daily checklist; past days keep them. */
export function setSupplementArchived(data: AppData, id: string, archived: boolean): AppData {
  return { ...data, supplements: data.supplements.map((s) => (s.id === id ? { ...s, archived } : s)) };
}

export function toggleSupplement(data: AppData, date: string, id: string): AppData {
  const taken = data.suppLog[date] ?? [];
  const next = taken.includes(id) ? taken.filter((x) => x !== id) : [...taken, id];
  return { ...data, suppLog: { ...data.suppLog, [date]: next } };
}

/** Consecutive days with every active supplement taken. An unfinished today doesn't break it. */
export function suppStreak(data: AppData, today: string): number {
  const active = activeSupplements(data);
  if (!active.length) return 0;
  const full = (date: string) => active.every((s) => (data.suppLog[date] ?? []).includes(s.id));
  let day = dayjs(today);
  if (!full(today)) day = day.subtract(1, 'day');
  let n = 0;
  while (full(day.format('YYYY-MM-DD'))) {
    n++;
    day = day.subtract(1, 'day');
  }
  return n;
}