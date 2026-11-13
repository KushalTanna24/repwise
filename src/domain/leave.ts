import dayjs from 'dayjs';
import type { AppData, LeaveRange } from './types';

export const MAX_BACKDATE_DAYS = 30;

const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
const covers = (r: LeaveRange, date: string) => date >= r.start && (r.end === null || date <= r.end);

export const onLeave = (data: AppData, date: string) => data.leave.some((r) => covers(r, date));
export const currentLeave = (data: AppData, today: string) => data.leave.find((r) => covers(r, today)) ?? null;

/** Adds a range, merging any it overlaps or touches. */
export function startLeave(data: AppData, start: string, end: string | null, today: string): AppData | { error: string } {
  if (start < fmt(dayjs(today).subtract(MAX_BACKDATE_DAYS, 'day'))) return { error: 'Leave can start at most 30 days ago.' };
  if (end !== null && end < start) return { error: 'End date is before the start.' };
  let merged: LeaveRange = { start, end };
  const rest: LeaveRange[] = [];
  for (const r of data.leave) {
    const dayAfter = (x: string | null) => (x === null ? null : fmt(dayjs(x).add(1, 'day')));
    const touches = (a: LeaveRange, b: LeaveRange) => a.end === null || b.start <= dayAfter(a.end)!;
    const overlap = merged.start <= r.start ? touches(merged, r) : touches(r, merged);
    if (!overlap) {
      rest.push(r);
      continue;
    }
    merged = { start: r.start < merged.start ? r.start : merged.start, end: r.end === null || merged.end === null ? null : r.end > merged.end ? r.end : merged.end };
  }
  return { ...data, leave: [...rest, merged].sort((a, b) => a.start.localeCompare(b.start)) };
}

/** Today counts again: the range ends yesterday, or disappears if it began today. */
export function endLeave(data: AppData, today: string): AppData {
  const cur = currentLeave(data, today);
  if (!cur) return data;
  const yesterday = fmt(dayjs(today).subtract(1, 'day'));
  const leave = cur.start >= today ? data.leave.filter((r) => r !== cur) : data.leave.map((r) => (r === cur ? { ...r, end: yesterday } : r));
  return { ...data, leave };
}
