import dayjs from 'dayjs';
import type { ChallengeDraft } from './challengeTemplates';
import { photoFor } from './photos';
import type { AppData, ChallengeRun, ChallengeTask } from './types';

export const MAX_ACTIVE = 3;

const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
const lastDay = (run: ChallengeRun) => fmt(dayjs(run.startDate).add(run.days - 1, 'day'));
/** Dates before yesterday can no longer be ticked. */
const lockedBefore = (today: string) => fmt(dayjs(today).subtract(1, 'day'));

export const activeRuns = (data: AppData) => data.challenges.filter((r) => r.status === 'active');
/** Runs to show on Today: running today or starting soon. A run whose last day was yesterday waits to settle off-screen. */
export const runsForToday = (data: AppData, today: string) => activeRuns(data).filter((r) => r.startDate > today || runCoversDate(r, today));
export const canStart = (data: AppData) => activeRuns(data).length < MAX_ACTIVE;

export function startChallenge(data: AppData, draft: ChallengeDraft, startDate: string, id: string = crypto.randomUUID()): AppData {
  if (!canStart(data)) return data;
  const run: ChallengeRun = { ...draft, id, startDate, ticks: {}, status: 'active', restarts: 0 };
  return { ...data, challenges: [...data.challenges, run] };
}

/** 1-based day of the current attempt. */
export const dayNumber = (run: ChallengeRun, date: string) => dayjs(date).diff(dayjs(run.startDate), 'day') + 1;

export function runCoversDate(run: ChallengeRun, date: string): boolean {
  return date >= run.startDate && date <= lastDay(run) && (!run.endedOn || date <= run.endedOn);
}

/** Dates with a workout, built once per document; taskDone runs for every day of every run. */
const workoutDays = new WeakMap<AppData, { any: Set<string>; run: Set<string> }>();
function workoutsOf(data: AppData) {
  let w = workoutDays.get(data);
  if (!w) {
    w = { any: new Set(data.extras.map((x) => x.date)), run: new Set(data.extras.filter((x) => x.type === 'run').map((x) => x.date)) };
    for (const s of data.sessions) if (s.finishedAt) w.any.add(dayjs(s.startedAt).format('YYYY-MM-DD'));
    workoutDays.set(data, w);
  }
  return w;
}

/** Auto tasks tick themselves; the outdoor one can also be ticked for a ride, hike or anything not logged as a run. */
export const canTickByHand = (task: ChallengeTask) => !task.auto || task.auto === 'workout-outdoor';

export function taskDone(data: AppData, run: ChallengeRun, task: ChallengeTask, date: string): boolean {
  if (run.ticks[date]?.includes(task.id)) return true;
  if (task.kind === 'photo' && photoFor(data, run.id, date)) return true;
  switch (task.auto) {
    case 'workout':
      return workoutsOf(data).any.has(date);
    case 'workout-outdoor':
      return workoutsOf(data).run.has(date);
    case 'water':
      return (data.water[date] ?? 0) >= (task.target ?? data.profile.waterGoal);
    default:
      return false;
  }
}

export const dayComplete = (data: AppData, run: ChallengeRun, date: string) => run.tasks.every((t) => taskDone(data, run, t, date));

export const canTick = (date: string, today: string) => date >= lockedBefore(today) && date <= today;

function updateRun(data: AppData, runId: string, fn: (r: ChallengeRun) => ChallengeRun | null): AppData {
  const run = data.challenges.find((r) => r.id === runId);
  const next = run && fn(run);
  return next ? { ...data, challenges: data.challenges.map((r) => (r.id === runId ? next : r)) } : data;
}

export function toggleTask(data: AppData, runId: string, taskId: string, date: string, today: string): AppData {
  if (!canTick(date, today)) return data;
  return updateRun(data, runId, (r) => {
    const task = r.tasks.find((t) => t.id === taskId);
    if (!task || !canTickByHand(task) || r.status !== 'active' || !runCoversDate(r, date)) return null;
    const cur = r.ticks[date] ?? [];
    const ticks = cur.includes(taskId) ? cur.filter((x) => x !== taskId) : [...cur, taskId];
    return { ...r, ticks: { ...r.ticks, [date]: ticks } };
  });
}

/** Ends runs whose days have locked: a strict miss fails, a locked last day finishes. */
export function settleChallenges(data: AppData, today: string): AppData {
  const lock = lockedBefore(today);
  let changed = false;
  const challenges = data.challenges.map((r) => {
    if (r.status !== 'active' || r.startDate >= lock) return r;
    const last = lastDay(r);
    if (r.rule === 'strict') {
      for (let d = dayjs(r.startDate); fmt(d) < lock && fmt(d) <= last; d = d.add(1, 'day')) {
        if (!dayComplete(data, r, fmt(d))) {
          changed = true;
          return { ...r, status: 'failed' as const, failedDay: dayNumber(r, fmt(d)), endedOn: today };
        }
      }
    }
    if (last >= lock) return r;
    changed = true;
    return { ...r, status: 'done' as const, endedOn: today };
  });
  return changed ? { ...data, challenges } : data;
}

export function restartChallenge(data: AppData, runId: string, today: string): AppData {
  return updateRun(data, runId, ({ failedDay: _f, failAck: _a, endedOn: _e, ...r }) => ({ ...r, startDate: today, restarts: r.restarts + 1, status: 'active' }));
}

export const ackChallengeFail = (data: AppData, runId: string) => updateRun(data, runId, (r) => ({ ...r, failAck: true }));

export function quitChallenge(data: AppData, runId: string, today: string): AppData {
  return updateRun(data, runId, (r) => (r.status === 'active' ? { ...r, status: 'quit', endedOn: today } : null));
}

/** Days complete out of days elapsed so far (start through today, capped at the last day). */
export function challengeScore(data: AppData, run: ChallengeRun, today: string): { complete: number; elapsed: number; days: number } {
  const end = [today, lastDay(run), run.endedOn ?? today].sort()[0];
  let complete = 0;
  let elapsed = 0;
  for (let d = dayjs(run.startDate); fmt(d) <= end; d = d.add(1, 'day')) {
    elapsed++;
    if (dayComplete(data, run, fmt(d))) complete++;
  }
  return { complete, elapsed, days: run.days };
}
