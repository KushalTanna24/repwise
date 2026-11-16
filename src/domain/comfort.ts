import type { SplitId } from './training';
import type { AppData, ComfortScore, WorkoutSession } from './types';

export const COMFORT_LABELS: Record<ComfortScore, string> = {
  1: 'Awkward',
  2: 'Clunky',
  3: 'Okay',
  4: 'Smooth',
  5: 'Spot on',
};

/** Ratings older than this many per day stop counting, so a reshuffle shows up quickly. */
const RECENT_PER_DAY = 5;

/** Log how the exercise order felt. A null score clears the rating. */
export function rateSession(data: AppData, sessionId: string, score: ComfortScore | null, note?: string): AppData {
  const s = data.sessions.find((x) => x.id === sessionId);
  if (!s) return data;
  let comfort: WorkoutSession['comfort'];
  if (score != null) {
    const text = note === undefined ? s.comfort?.note : note.trim() || undefined;
    comfort = { score, ...(text ? { note: text } : {}) };
  }
  if (comfort?.score === s.comfort?.score && comfort?.note === s.comfort?.note) return data;
  const { comfort: _, ...rest } = s;
  const next: WorkoutSession = comfort ? { ...rest, comfort } : rest;
  return { ...data, sessions: data.sessions.map((x) => (x.id === sessionId ? next : x)) };
}

export interface SplitComfort {
  avg: number;
  count: number;
  /** Keyed by the day's index in the split. */
  days: Record<number, { avg: number; count: number }>;
}

/** Average comfort for a split and each of its days, from recent ratings. */
export function splitComfort(data: AppData, splitId: SplitId): SplitComfort | null {
  // A custom split's days can be reordered on edit, so older ratings would land on the wrong day.
  const since = data.customSplits.find((c) => c.id === splitId)?.updatedAt;
  const byDay = new Map<number, number[]>();
  for (const s of data.sessions) {
    if (s.splitId !== splitId || s.sessionIndex == null || !s.comfort || (since && s.startedAt < since)) continue;
    byDay.set(s.sessionIndex, [...(byDay.get(s.sessionIndex) ?? []), s.comfort.score]);
  }
  if (!byDay.size) return null;
  const days: SplitComfort['days'] = {};
  const all: number[] = [];
  for (const [day, scores] of byDay) {
    const recent = scores.slice(-RECENT_PER_DAY);
    days[day] = { avg: recent.reduce((a, b) => a + b, 0) / recent.length, count: recent.length };
    all.push(...recent);
  }
  return { avg: all.reduce((a, b) => a + b, 0) / all.length, count: all.length, days };
}
