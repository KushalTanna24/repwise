import dayjs from 'dayjs';
import type { AppData, Fast } from './types';

export const FAST_TARGETS = [16, 24, 36] as const;
export type FastTarget = (typeof FAST_TARGETS)[number];

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

export const elapsedHours = (fast: Fast, now: string) => (Date.parse(fast.endedAt ?? now) - Date.parse(fast.startedAt)) / 3_600_000;

export const fastPhase = (hours: number) => FAST_PHASES.filter((p) => hours >= p.fromH).at(-1)!.label;

export const fastReached = (fast: Fast) => !!fast.endedAt && elapsedHours(fast, fast.endedAt) >= fast.targetHours;

export const needsSafetyAck = (data: AppData, target: number) => target >= 24 && !data.profile.fastingSafetyAck;

export function startFast(data: AppData, target: FastTarget, now: string, id: string = crypto.randomUUID()): AppData {
  if (activeFast(data)) return data;
  return { ...data, fasts: [...data.fasts, { id, startedAt: now, endedAt: null, targetHours: target }] };
}

export function endFast(data: AppData, now: string): AppData {
  const f = activeFast(data);
  if (!f) return data;
  return { ...data, fasts: data.fasts.map((x) => (x.id === f.id ? { ...x, endedAt: now } : x)) };
}

export const fastsEndedOn = (data: AppData, date: string) => data.fasts.filter((f) => f.endedAt && dayjs(f.endedAt).format('YYYY-MM-DD') === date);
