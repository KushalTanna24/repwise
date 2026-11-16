import dayjs from 'dayjs';
import type { AppData, BodyWeight, Kg, SetRecord, WorkoutSession } from './types';

const LB_PER_KG = 2.20462;

export const localDate = (iso: string) => dayjs(iso).format('YYYY-MM-DD');

/** Accepts "62,5" as well as "62.5". Empty, negative or junk input gives null. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function bmi(kg: number | undefined, heightCm: number | undefined): number | null {
  if (!kg || !heightCm) return null;
  const m = heightCm / 100;
  return +(kg / (m * m)).toFixed(1);
}

export const toDisplay = (kg: Kg, units: 'kg' | 'lb') => (units === 'lb' ? +(kg * LB_PER_KG).toFixed(1) : +kg.toFixed(2));
export const fromDisplay = (v: number, units: 'kg' | 'lb') => (units === 'lb' ? v / LB_PER_KG : v);

export function latestWeight(data: AppData): BodyWeight | undefined {
  return [...data.bodyweights].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

const doneSets = (s: WorkoutSession, exerciseId?: string): SetRecord[] =>
  s.exercises.filter((e) => !exerciseId || e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((x) => x.status === 'done' && x.actualReps != null));

const weekStart = (d: dayjs.Dayjs) => d.startOf('day').subtract((d.day() + 6) % 7, 'day');

export type Period = 'day' | 'week' | 'month';

/** Target sets per workout, for the sets ring. */
export const SETS_PER_WORKOUT = 15;

/** Workouts, sets and water for one period, each against a target for that same period. */
export function periodStats(data: AppData, now: string, period: Period) {
  const n = dayjs(now);
  const from = period === 'day' ? n.startOf('day') : period === 'week' ? weekStart(n) : n.startOf('month');
  const days = period === 'day' ? 1 : period === 'week' ? 7 : n.daysInMonth();
  const inPeriod = data.sessions.filter((s) => s.finishedAt && !dayjs(s.startedAt).isBefore(from) && !dayjs(s.startedAt).isAfter(n.endOf('day')));
  let glasses = 0;
  for (let i = 0; i < days; i++) glasses += data.water[from.add(i, 'day').format('YYYY-MM-DD')] ?? 0;
  const sessions = period === 'day' ? 1 : Math.round((data.profile.daysPerWeek * days) / 7);
  return {
    sessions: inPeriod.length,
    sets: inPeriod.reduce((x, s) => x + doneSets(s).length, 0),
    glasses,
    targets: { sessions, sets: sessions * SETS_PER_WORKOUT, glasses: data.profile.waterGoal * days },
  };
}

export function weekStats(data: AppData, now: string) {
  const finished = data.sessions.filter((s) => s.finishedAt);
  const perWeek = new Map<string, number>();
  for (const s of finished) {
    const k = weekStart(dayjs(s.startedAt)).format('YYYY-MM-DD');
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  const thisWeek = weekStart(dayjs(now));
  const inWeek = finished.filter((s) => !dayjs(s.startedAt).isBefore(thisWeek));
  const met = (w: dayjs.Dayjs) => (perWeek.get(w.format('YYYY-MM-DD')) ?? 0) >= data.profile.daysPerWeek;

  let streakWeeks = 0;
  let w = met(thisWeek) ? thisWeek : thisWeek.subtract(1, 'week');
  while (met(w)) {
    streakWeeks++;
    w = w.subtract(1, 'week');
  }
  return { sessions: inWeek.length, sets: inWeek.reduce((n, s) => n + doneSets(s).length, 0), streakWeeks };
}

interface Best {
  kg: number;
  reps: number;
}
const better = (a: Best, b: Best) => a.kg > b.kg || (a.kg === b.kg && a.reps > b.reps);
function best(sets: SetRecord[]): Best | null {
  let top: Best | null = null;
  for (const s of sets) {
    const cur = { kg: s.actualKg ?? 0, reps: s.actualReps! };
    if (!top || better(cur, top)) top = cur;
  }
  return top;
}

export interface HistoryPoint {
  date: string;
  sessionId: string;
  bestKg: number;
  bestReps: number;
  volume: number;
  totalReps: number;
  sets: SetRecord[];
}

/** One point per finished session in which the exercise had done sets. */
export function exerciseHistory(data: AppData, exerciseId: string): HistoryPoint[] {
  return data.sessions
    .filter((s) => s.finishedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => ({ s, sets: doneSets(s, exerciseId) }))
    .filter((x) => x.sets.length)
    .map(({ s, sets }) => {
      const b = best(sets)!;
      return {
        date: localDate(s.startedAt),
        sessionId: s.id,
        bestKg: b.kg,
        bestReps: b.reps,
        volume: sets.reduce((n, x) => n + (x.actualKg ?? 0) * x.actualReps!, 0),
        totalReps: sets.reduce((n, x) => n + x.actualReps!, 0),
        sets,
      };
    });
}

export function bestSet(data: AppData, exerciseId: string): (Best & { date: string }) | null {
  let top: (Best & { date: string }) | null = null;
  for (const p of exerciseHistory(data, exerciseId)) {
    const cur = { kg: p.bestKg, reps: p.bestReps, date: p.date };
    if (!top || better(cur, top)) top = cur;
  }
  return top;
}

/** Records beaten in this session compared with everything before it. First attempts are not records. */
export function sessionPRs(data: AppData, session: WorkoutSession): { exerciseId: string; kg: number; reps: number }[] {
  const before = data.sessions.filter((s) => s.id !== session.id && s.finishedAt && s.startedAt < session.startedAt);
  const ids = [...new Set(session.exercises.map((e) => e.exerciseId))];
  return ids.flatMap((exerciseId) => {
    const now = best(doneSets(session, exerciseId));
    const prior = best(before.flatMap((s) => doneSets(s, exerciseId)));
    return now && prior && better(now, prior) ? [{ exerciseId, ...now }] : [];
  });
}

export function sessionVolume(s: WorkoutSession): { sets: number; volume: number } {
  const sets = doneSets(s);
  return { sets: sets.length, volume: sets.reduce((n, x) => n + (x.actualKg ?? 0) * x.actualReps!, 0) };
}
