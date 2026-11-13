import dayjs, { type Dayjs } from 'dayjs';
import { getExercise } from '../../catalogue';
import { setScore } from '../../strength';
import { findSlot } from '../../training';
import type { AppData, WorkoutSession } from '../../types';
import { metaFor, primaryGroups } from './exerciseMeta';
import { GROUPS, type Group } from './groups';

export interface History {
  /** At least 3 of the last 6 weeks had 2 or more finished sessions. */
  qualifies: boolean;
  /** Real weekly hard sets per group over the last 6 weeks, primary 1 and secondary 0.5. */
  baseline: Record<Group, number>;
  /** Estimated 1RM trend of each group's primary lifts over 8 weeks. */
  trend: Partial<Record<Group, { change: number; flatWeeks: number; lift: string }>>;
  /** Finished sessions over 8 weeks against what the weekly day count asks for, capped at 1. */
  adherence: number;
  /** Median share of planned exercises finished over the last 6 sessions; null with fewer. */
  finishRate: number | null;
  liked: Set<string>;
  avoided: Set<string>;
}

const BASELINE_WEEKS = 6;
const TREND_WEEKS = 8;
const RISE = 0.01;

const mondayOf = (d: Dayjs) => d.startOf('day').subtract((d.day() + 6) % 7, 'day');

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function readHistory(data: AppData, now: string): History {
  const today = dayjs(now);
  const monday = mondayOf(today);
  const baselineFrom = monday.subtract(BASELINE_WEEKS * 7, 'day');
  const trendFrom = today.subtract(TREND_WEEKS * 7, 'day');
  const finished = data.sessions.filter((s) => s.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const exercise = (id: string) => getExercise(id, data.customExercises);
  const doneSets = (e: WorkoutSession['exercises'][number]) => e.sets.filter((x) => x.status === 'done');

  // Weeks with 2+ sessions, and the baseline over the same 6 complete weeks.
  const perWeek = new Map<string, number>();
  const totals = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  for (const s of finished) {
    const t = dayjs(s.startedAt);
    if (t.isBefore(baselineFrom) || !t.isBefore(monday)) continue;
    const key = mondayOf(t).format('YYYY-MM-DD');
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
    for (const e of s.exercises) {
      const ex = exercise(e.exerciseId);
      const n = doneSets(e).length;
      if (!ex || !n) continue;
      for (const [g, w] of Object.entries(metaFor(ex).muscles) as [Group, number][]) totals[g] += n * w;
    }
  }
  const qualifies = [...perWeek.values()].filter((n) => n >= 2).length >= 3;
  const baseline = Object.fromEntries(GROUPS.map((g) => [g, Math.round((totals[g] / BASELINE_WEEKS) * 2) / 2])) as Record<Group, number>;

  // Best set per session for each lift over 8 weeks.
  const recent = finished.filter((s) => !dayjs(s.startedAt).isBefore(trendFrom));
  const series = new Map<string, { at: Dayjs; score: number }[]>();
  const skips = new Map<string, number>();
  const swaps = new Map<string, number>();
  for (const s of recent) {
    for (const e of s.exercises) {
      if (e.skipped) skips.set(e.exerciseId, (skips.get(e.exerciseId) ?? 0) + 1);
      const slot = findSlot(data, s.splitId, e.slotId);
      const planned = slot?.candidates[0];
      if (planned && planned !== e.exerciseId) swaps.set(planned, (swaps.get(planned) ?? 0) + 1);
      const ex = exercise(e.exerciseId);
      const done = doneSets(e).filter((x) => x.actualReps != null);
      if (!ex || !done.length) continue;
      const score = Math.max(...done.map((x) => setScore(ex.kind, x)));
      if (score > 0) series.set(ex.id, [...(series.get(ex.id) ?? []), { at: dayjs(s.startedAt), score }]);
    }
  }

  const lifts = new Map<string, { change: number; flatWeeks: number; sessions: number }>();
  for (const [id, pts] of series) {
    if (pts.length < 3) continue;
    let best = pts[0].score;
    let lastRise = pts[0].at;
    for (const p of pts.slice(1)) {
      if (p.score >= best * (1 + RISE)) lastRise = p.at;
      best = Math.max(best, p.score);
    }
    lifts.set(id, { change: (pts.at(-1)!.score - pts[0].score) / pts[0].score, flatWeeks: Math.floor(today.diff(lastRise, 'day') / 7), sessions: pts.length });
  }

  const trend: History['trend'] = {};
  for (const g of GROUPS) {
    const mine = [...lifts].filter(([id]) => {
      const ex = exercise(id);
      return ex && primaryGroups(metaFor(ex)).includes(g);
    });
    if (!mine.length) continue;
    trend[g] = {
      change: mine.reduce((a, [, l]) => a + l.change, 0) / mine.length,
      flatWeeks: Math.min(...mine.map(([, l]) => l.flatWeeks)),
      // The most-logged lift names the reason line.
      lift: mine.reduce((a, b) => (b[1].sessions > a[1].sessions ? b : a))[0],
    };
  }

  const expected = Math.max(1, data.profile.daysPerWeek * TREND_WEEKS);
  const last6 = finished.slice(-6);
  const finishRate =
    last6.length < 6 ? null : median(last6.map((s) => (s.exercises.length ? s.exercises.filter((e) => doneSets(e).length > 0).length / s.exercises.length : 1)));

  return {
    qualifies,
    baseline,
    trend,
    adherence: Math.min(1, recent.length / expected),
    finishRate,
    liked: new Set([...lifts].filter(([, l]) => l.change > 0).map(([id]) => id)),
    avoided: new Set([...[...skips].filter(([, n]) => n >= 3), ...[...swaps].filter(([, n]) => n >= 3)].map(([id]) => id)),
  };
}
