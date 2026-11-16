import type { RotationState, SplitDef } from './types';

export interface WeekDay {
  sessionIndex: number;
  title: string;
  state: 'done' | 'current' | 'upcoming';
}

/**
 * The user's training week: `days` sessions in rotation order. Counted in
 * sessions, not calendar days, so a 3-day split trained 6 times a week shows
 * all six sessions with the current one marked.
 */
export function weekView(split: Pick<SplitDef, 'sessions'>, days: number, rot: RotationState): WeekDay[] {
  const len = split.sessions.length;
  const perWeek = Math.min(7, Math.max(1, Math.round(days)));
  if (!len) return [];
  const done = (rot.cycle - 1) * len + rot.sessionIndex;
  const start = done - (done % perWeek);
  return Array.from({ length: perWeek }, (_, k) => {
    const sessionIndex = (start + k) % len;
    const at = start + k;
    return { sessionIndex, title: split.sessions[sessionIndex].title, state: at < done ? 'done' : at === done ? 'current' : 'upcoming' };
  });
}

const TIMES: Record<number, string> = { 1: 'once', 2: 'twice' };

/** One line on how a rotation of `len` days fills a `days`-per-week schedule. */
export function weekSummary(len: number, days: number): string {
  if (len <= 0) return '';
  if (days % len === 0) {
    const n = days / len;
    if (n === 1) return 'Each day once a week';
    return `Each day ${TIMES[n] ?? `${n} times`} a week. Extras change ${n === 2 ? 'on the second round' : 'each round'}`;
  }
  if (days > len) return `${days} sessions a week from a ${len}-day rotation`;
  const weeks = Math.ceil((len / days) * 2) / 2;
  return `One full rotation takes about ${weeks} weeks`;
}
