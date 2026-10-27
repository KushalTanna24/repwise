import dayjs from 'dayjs';
import { dayComplete, runCoversDate } from './challenges';
import { fastReached } from './fasting';
import { activeSupplements } from './supplements';
import type { AppData, ExtraSession, Fast, WorkoutSession } from './types';

export type GoalKind = 'workout' | 'water' | 'supplements' | 'challenge' | 'fast';
export const GOAL_COLOR: Record<GoalKind, string> = { workout: '#FF2D55', water: '#007AFF', supplements: '#AF52DE', challenge: '#FF9500', fast: '#34C759' };
export const GOAL_LABEL: Record<GoalKind, string> = { workout: 'Workout', water: 'Water', supplements: 'Supplements', challenge: 'Challenges', fast: 'Fasts' };

export interface GoalStatus {
  done: boolean;
  progress?: [number, number];
  detail?: string;
}
export interface Goal {
  id: string;
  kind: GoalKind;
  label: string;
  color: string;
  status: GoalStatus;
  runId?: string;
}

const day = (iso: string) => dayjs(iso).format('YYYY-MM-DD');
function group<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

/** Precomputes per-date indexes once; call the result per date. */
export function goalIndex(data: AppData): (date: string) => Goal[] {
  const sessions = group<WorkoutSession>(data.sessions, (s) => (s.finishedAt ? day(s.startedAt) : null));
  const extras = group<ExtraSession>(data.extras, (x) => x.date);
  const fasts = group<Fast>(data.fasts, (f) => (f.endedAt ? day(f.endedAt) : null));
  const stack = activeSupplements(data);
  const make = (kind: GoalKind, status: GoalStatus, id: string = kind, label = GOAL_LABEL[kind]): Goal => ({ id, kind, label, color: GOAL_COLOR[kind], status });

  return (date) => {
    const s = sessions.get(date) ?? [];
    const x = extras.get(date) ?? [];
    const first = s[0];
    const detail = first
      ? `${first.title} · ${Math.round((Date.parse(first.finishedAt!) - Date.parse(first.startedAt)) / 60_000)} min`
      : x[0] && `${x[0].type[0].toUpperCase()}${x[0].type.slice(1)}${x[0].minutes ? ` · ${x[0].minutes} min` : ''}`;
    const glasses = data.water[date] ?? 0;
    const goals: Goal[] = [
      make('workout', { done: s.length + x.length > 0, ...(detail ? { detail } : {}) }),
      make('water', { done: glasses >= data.profile.waterGoal, progress: [glasses, data.profile.waterGoal] }),
    ];
    if (stack.length) {
      const taken = stack.filter((p) => data.suppLog[date]?.includes(p.id)).length;
      goals.push(make('supplements', { done: taken === stack.length, progress: [taken, stack.length] }));
    }
    for (const r of data.challenges) {
      if (!runCoversDate(r, date)) continue;
      goals.push({ ...make('challenge', { done: dayComplete(data, r, date) }, `challenge:${r.id}`, r.title), runId: r.id });
    }
    const f = fasts.get(date);
    if (f) goals.push(make('fast', { done: f.some(fastReached), detail: `${f[0].targetHours}h target` }));
    return goals;
  };
}

export const goalsFor = (data: AppData, date: string) => goalIndex(data)(date);

/** Earliest date with any goal done, or null. */
export function firstGoalDate(data: AppData): string | null {
  const candidates = [
    ...data.sessions.filter((s) => s.finishedAt).map((s) => day(s.startedAt)),
    ...data.extras.map((x) => x.date),
    ...Object.keys(data.water),
    ...Object.keys(data.suppLog),
    ...data.challenges.map((r) => r.startDate),
    ...data.fasts.filter((f) => f.endedAt).map((f) => day(f.endedAt!)),
  ].sort();
  const at = goalIndex(data);
  return candidates.find((d) => at(d).some((g) => g.status.done)) ?? null;
}
