/** Test-only builders for plan v2. Not imported by production code. */
import dayjs from 'dayjs';
import { emptyAppData } from '../../catalogue';
import type { SplitId } from '../../training';
import type { AppData, Profile, SetRecord, WorkoutSession } from '../../types';
import { GROUPS, type Group } from './groups';
import type { History } from './history';
import { allocate } from './allocate';
import { makeCtx, type Ctx } from './select';
import { styleLayout, type FixedStyle } from './styles';
import { weeklyTargets } from './targets';

export const NOW = '2026-11-14T08:00:00.000Z';

/** Local date `weeksBack` whole weeks before the Monday of NOW's week, plus `day` days (0 = Monday). */
export function weekDay(weeksBack: number, day = 1): string {
  const d = dayjs(NOW);
  const monday = d.subtract((d.day() + 6) % 7, 'day').startOf('day');
  return monday.subtract(weeksBack * 7, 'day').add(day, 'day').hour(10).toISOString();
}

export function daysAgo(n: number): string {
  return dayjs(NOW).subtract(n, 'day').hour(10).toISOString();
}

export interface LoggedExercise {
  id: string;
  kg: number | null;
  reps: number | null;
  /** Done sets. */
  n: number;
  /** Extra sets left pending. */
  pending?: number;
  skipped?: boolean;
  slotId?: string;
}

let seq = 0;

export function sessionOn(startedAt: string, exercises: LoggedExercise[], opts: { finished?: boolean; splitId?: SplitId | null } = {}): WorkoutSession {
  const set = (status: SetRecord['status'], kg: number | null, reps: number | null): SetRecord => ({
    targetKg: null,
    targetReps: null,
    actualKg: status === 'done' ? kg : null,
    actualReps: status === 'done' ? reps : null,
    status,
  });
  return {
    id: `s${++seq}`,
    planKey: null,
    splitId: opts.splitId ?? null,
    sessionIndex: null,
    cycle: null,
    title: 'T',
    startedAt,
    finishedAt: opts.finished === false ? null : dayjs(startedAt).add(1, 'hour').toISOString(),
    exercises: exercises.map((e) => ({
      exerciseId: e.id,
      slotId: e.slotId ?? null,
      plan: null,
      rec: null,
      skipped: e.skipped,
      sets: [...Array.from({ length: e.n }, () => set('done', e.kg, e.reps)), ...Array.from({ length: e.pending ?? 0 }, () => set('pending', null, null))],
    })),
  };
}

/** A qualifying history with zero baselines; override what the test needs. */
export function hist(o: Partial<Omit<History, 'baseline'>> & { baseline?: Partial<Record<Group, number>> } = {}): History {
  const baseline = { ...(Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>), ...o.baseline };
  return { qualifies: true, trend: {}, adherence: 1, finishRate: null, liked: new Set(), avoided: new Set(), ...o, baseline };
}

/** A selection context for one fixed style, with no history. */
export function ctxFor(profile: Partial<Profile>, style: FixedStyle, history: History | null = null): Ctx {
  const data = dataWith([], profile);
  const targets = weeklyTargets(data.profile, history);
  const layout = styleLayout(style, data.profile.daysPerWeek);
  return makeCtx(data, targets, layout, allocate(layout, targets, data.profile.daysPerWeek), history, NOW);
}

export function dataWith(sessions: WorkoutSession[], profile: Partial<Profile> = {}): AppData {
  const d = emptyAppData(NOW);
  return { ...d, sessions, profile: { ...d.profile, ...profile } };
}
