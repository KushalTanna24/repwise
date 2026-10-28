import dayjs from 'dayjs';
import type { AppData, Fast } from './types';

export const FAST_PRESETS = [12, 16, 24] as const;
export const FAST_MAX_H = 72;

/** Whole hours, 1 to FAST_MAX_H. */
export const validFastHours = (h: number) => Number.isInteger(h) && h >= 1 && h <= FAST_MAX_H;

/** General guidance, not medical claims. */
export const FAST_PHASES: { fromH: number; label: string }[] = [
  { fromH: 0, label: 'Digesting' },
  { fromH: 4, label: 'Blood sugar settling' },
  { fromH: 12, label: 'Fat burning' },
  { fromH: 18, label: 'Ketosis' },
  { fromH: 24, label: 'Autophagy ramping up' },
];

/** Push alerts fire at these hours, plus the fast's own target. */
export const FAST_MILESTONES_H = [12, 24, 36];

export const activeFast = (data: AppData): Fast | null => data.fasts.find((f) => !f.endedAt) ?? null;

/** Never negative: a clock a little behind the start reads as zero. */
export const elapsedHours = (fast: Fast, now: string) => Math.max(0, (Date.parse(fast.endedAt ?? now) - Date.parse(fast.startedAt)) / 3_600_000);

export const fastPhase = (hours: number) => (FAST_PHASES.filter((p) => hours >= p.fromH).at(-1) ?? FAST_PHASES[0]).label;

export const fastEndsAt = (fast: Fast) => new Date(Date.parse(fast.startedAt) + fast.targetHours * 3_600_000).toISOString();

/** "Ends today 22:00", "Ends tomorrow 12:00", "Ends Thu 12:00", or "Target reached 12:00" once past. */
export function fmtFastEnd(fast: Fast, now: string): string {
  const end = dayjs(fastEndsAt(fast));
  const n = dayjs(now);
  const time = end.format('HH:mm');
  if (!end.isAfter(n)) return `Target reached ${time}`;
  const days = end.startOf('day').diff(n.startOf('day'), 'day');
  return `Ends ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : end.format('ddd')} ${time}`;
}

export const fastReached = (fast: Fast) => !!fast.endedAt && elapsedHours(fast, fast.endedAt) >= fast.targetHours;

export const needsSafetyAck = (data: AppData, target: number) => target >= 24 && !data.profile.fastingSafetyAck;

export function startFast(data: AppData, target: number, now: string, id: string = crypto.randomUUID()): AppData {
  if (activeFast(data) || !validFastHours(target)) return data;
  return { ...data, fasts: [...data.fasts, { id, startedAt: now, endedAt: null, targetHours: target }] };
}

export function endFast(data: AppData, now: string): AppData {
  const f = activeFast(data);
  if (!f) return data;
  return { ...data, fasts: data.fasts.map((x) => (x.id === f.id ? { ...x, endedAt: now } : x)) };
}

export const fastsEndedOn = (data: AppData, date: string) => data.fasts.filter((f) => f.endedAt && dayjs(f.endedAt).format('YYYY-MM-DD') === date);
