import dayjs from 'dayjs';
import { fastReached, elapsedHours } from './fasting';
import { sessionPRs } from './stats';
import { streak } from './streak';
import type { AppData, ChallengeRun } from './types';

export type BadgeId =
  | 'streak-3'
  | 'streak-7'
  | 'streak-30'
  | 'streak-100'
  | 'streak-365'
  | 'first-workout'
  | 'first-pr'
  | 'workouts-50'
  | 'workouts-100'
  | 'hydrated-week'
  | 'finish-75'
  | 'finish-stack'
  | 'finish-custom'
  | 'fast-24'
  | 'fast-36';

export interface BadgeDef {
  id: BadgeId;
  title: string;
  description: string;
}

const STREAKS = [3, 7, 30, 100, 365] as const;

export const BADGES: BadgeDef[] = [
  ...STREAKS.map((n) => ({ id: `streak-${n}` as BadgeId, title: `${n}-day streak`, description: `Lit ${n} days in a row.` })),
  { id: 'first-workout', title: 'First workout', description: 'Finished your first session.' },
  { id: 'first-pr', title: 'First PR', description: 'Beat a personal best.' },
  { id: 'workouts-50', title: '50 workouts', description: 'Fifty finished sessions.' },
  { id: 'workouts-100', title: '100 workouts', description: 'A hundred finished sessions.' },
  { id: 'hydrated-week', title: 'Hydrated week', description: 'Water goal hit 7 days in a row.' },
  { id: 'finish-75', title: '75 days done', description: 'Finished the 75-Day Challenge.' },
  { id: 'finish-stack', title: 'Habit stacked', description: 'Finished a habit stack.' },
  { id: 'finish-custom', title: 'Own challenge done', description: 'Finished a challenge you built.' },
  { id: 'fast-24', title: '24-hour fast', description: 'Fasted a full day.' },
  { id: 'fast-36', title: '36-hour fast', description: 'Fasted 36 hours.' },
];

const day = (iso: string) => dayjs(iso).format('YYYY-MM-DD');
const FINISH: Record<ChallengeRun['templateId'], BadgeId> = { '75-day': 'finish-75', 'habit-stack': 'finish-stack', custom: 'finish-custom' };

const memo = new WeakMap<AppData, { today: string; out: Map<BadgeId, string> }>();

/** Every badge earned so far, with the local date it was earned. Memoized per document. */
export function earnedBadges(data: AppData, today: string): Map<BadgeId, string> {
  const hit = memo.get(data);
  if (hit?.today === today) return hit.out;
  const out = computeEarned(data, today);
  memo.set(data, { today, out });
  return out;
}

function computeEarned(data: AppData, today: string): Map<BadgeId, string> {
  const out = new Map<BadgeId, string>();
  const first = (id: BadgeId, date: string | undefined) => date && (!out.has(id) || date < out.get(id)!) && out.set(id, date);

  const counts = [...streak(data, today).counts].sort(([a], [b]) => a.localeCompare(b));
  for (const n of STREAKS) first(`streak-${n}`, counts.find(([, c]) => c >= n)?.[0]);

  const sessions = data.sessions.filter((s) => s.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  first('first-workout', sessions[0] && day(sessions[0].startedAt));
  first('workouts-50', sessions[49] && day(sessions[49].startedAt));
  first('workouts-100', sessions[99] && day(sessions[99].startedAt));
  const pr = sessions.find((s) => sessionPRs(data, s).length > 0);
  first('first-pr', pr && day(pr.startedAt));

  const wet = Object.keys(data.water).filter((d) => data.water[d] >= data.profile.waterGoal).sort();
  let run = 0;
  for (let i = 0; i < wet.length && !out.has('hydrated-week'); i++) {
    run = i > 0 && dayjs(wet[i]).diff(dayjs(wet[i - 1]), 'day') === 1 ? run + 1 : 1;
    if (run === 7) first('hydrated-week', wet[i]);
  }

  for (const r of data.challenges) if (r.status === 'done') first(FINISH[r.templateId], r.endedOn);
  for (const f of data.fasts) {
    if (!f.endedAt || !fastReached(f)) continue;
    const h = elapsedHours(f, f.endedAt);
    if (h >= 24) first('fast-24', day(f.endedAt));
    if (h >= 36) first('fast-36', day(f.endedAt));
  }
  return out;
}

/** Locked-badge hint, e.g. "12 days to go". */
export function badgeProgress(data: AppData, today: string, id: BadgeId): string | null {
  const m = /^streak-(\d+)$/.exec(id);
  if (m) return `${Number(m[1]) - streak(data, today).best} days to go`;
  const w = /^workouts-(\d+)$/.exec(id);
  if (w) return `${Number(w[1]) - data.sessions.filter((s) => s.finishedAt).length} workouts to go`;
  return null;
}

export function unseenBadges(data: AppData, today: string): BadgeId[] {
  const earned = earnedBadges(data, today);
  const seen = new Set(data.seenBadges ?? []);
  return BADGES.map((b) => b.id).filter((id) => earned.has(id) && !seen.has(id));
}

export function markBadgesSeen(data: AppData, ids: BadgeId[]): AppData {
  const seen = new Set(data.seenBadges ?? []);
  if (ids.every((id) => seen.has(id))) return data;
  return { ...data, seenBadges: [...seen, ...ids.filter((id) => !seen.has(id))] };
}

/** Pre-4.3 data celebrates nothing retroactively: everything already earned counts as seen. */
export function withBadgeBackfill(data: AppData, today: string): AppData {
  if (data.seenBadges !== undefined) return data;
  return { ...data, seenBadges: [...earnedBadges(data, today).keys()] };
}
