import dayjs from 'dayjs';
import { periodStats } from '../stats';
import { streak } from '../streak';
import { overallStrength } from '../strength';
import type { AppData } from '../types';

export interface MemberInput {
  userId: string;
  name: string;
  doc: AppData | null;
}

export interface BoardRow {
  userId: string;
  name: string;
  /** Finished workouts this week. */
  done: number;
  /** The member's own weekly target (days per week). */
  target: number;
  /** done / target, capped at 1 so training past your target never outranks someone who hit theirs. */
  consistency: number;
  streak: number;
  /** Strength against the member's own first sessions, e.g. 0.12; null until a lift has two sessions. */
  improvement: number | null;
  rank: number;
  targetHit: boolean;
  /** Top of last week's board. */
  crown: boolean;
}

type Scored = Omit<BoardRow, 'rank' | 'crown'>;

/**
 * The member's own streak. A group may not see supplement logs, which also light streak days,
 * so the streak the member's phone last wrote wins while it is fresh.
 */
function memberStreak(doc: AppData, today: string): number {
  const hint = doc.streakHint;
  const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD');
  if (hint && hint.date >= yesterday && hint.date <= today) return hint.current;
  return streak(doc, today).current;
}

function score(m: MemberInput, now: string, today: string): Scored {
  const target = Math.max(0, m.doc?.profile.daysPerWeek ?? 0);
  if (!m.doc) return { userId: m.userId, name: m.name, done: 0, target, consistency: 0, streak: 0, improvement: null, targetHit: false };
  // periodStats, not weekStats: weekStats' week-streak walk never ends when daysPerWeek is 0.
  const done = periodStats(m.doc, now, 'week').sessions;
  const consistency = target > 0 ? Math.min(done / target, 1) : 0;
  return {
    userId: m.userId,
    name: m.name,
    done,
    target,
    consistency,
    streak: memberStreak(m.doc, today),
    improvement: overallStrength(m.doc).change,
    targetHit: target > 0 && done >= target,
  };
}

const better = (a: Scored, b: Scored) =>
  a.consistency !== b.consistency ? a.consistency > b.consistency : a.streak !== b.streak ? a.streak > b.streak : a.done > b.done;
const tied = (a: Scored, b: Scored) => a.consistency === b.consistency && a.streak === b.streak && a.done === b.done;

function rank(rows: Scored[]): (Scored & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => (tied(a, b) ? a.name.localeCompare(b.name) : better(a, b) ? -1 : 1));
  return sorted.map((r) => ({ ...r, rank: 1 + sorted.filter((o) => better(o, r)).length }));
}

/** Weekly board in the viewer's week. Ranks by consistency, then streak, then workouts, never by kilos. */
export function scoreboard(members: MemberInput[], now: string, today: string): BoardRow[] {
  const lastNow = dayjs(now).subtract(7, 'day').toISOString();
  const lastToday = dayjs(today).subtract(7, 'day').format('YYYY-MM-DD');
  const last = rank(members.map((m) => score(m, lastNow, lastToday)));
  const crowned = new Set(last.filter((r) => r.rank === 1 && r.done > 0).map((r) => r.userId));
  return rank(members.map((m) => score(m, now, today))).map((r) => ({ ...r, crown: crowned.has(r.userId) }));
}
