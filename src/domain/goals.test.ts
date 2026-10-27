import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { endFast, startFast } from './fasting';
import { firstGoalDate, goalsFor } from './goals';
import { startChallenge } from './challenges';
import type { AppData, WorkoutSession } from './types';

const D = '2026-10-20';
const base = (): AppData => ({ ...emptyAppData(`${D}T08:00:00`), supplements: [] });
const sess = (startedAt: string, finishedAt: string | null): WorkoutSession => ({ id: startedAt, planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'Push A', startedAt, finishedAt, exercises: [] });
const goal = (d: AppData, date: string, id: string) => goalsFor(d, date).find((g) => g.id === id);

describe('goalsFor', () => {
  it('workout: finished session or an extra, not an unfinished session', () => {
    expect(goal({ ...base(), sessions: [sess(`${D}T07:00:00`, null)] }, D, 'workout')!.status.done).toBe(false);
    expect(goal({ ...base(), sessions: [sess(`${D}T07:00:00`, `${D}T08:00:00`)] }, D, 'workout')!.status.done).toBe(true);
    expect(goal({ ...base(), extras: [{ id: 'x', date: D, type: 'run', minutes: 30 }] }, D, 'workout')!.status.done).toBe(true);
  });

  it('a session started at 23:30 local belongs to that date', () => {
    const d = { ...base(), sessions: [sess(`${D}T23:30:00`, '2026-10-21T00:40:00')] };
    expect(goal(d, D, 'workout')!.status.done).toBe(true);
    expect(goal(d, '2026-10-21', 'workout')!.status.done).toBe(false);
  });

  it('water shows progress and is done at the goal', () => {
    expect(goal({ ...base(), water: { [D]: 6 } }, D, 'water')!.status).toMatchObject({ done: false, progress: [6, 8] });
    expect(goal({ ...base(), water: { [D]: 8 } }, D, 'water')!.status.done).toBe(true);
  });

  it('supplements only appear with a stack and need every one ticked', () => {
    expect(goal(base(), D, 'supplements')).toBeUndefined();
    const d = { ...base(), supplements: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], suppLog: { [D]: ['a'] } };
    expect(goal(d, D, 'supplements')!.status.done).toBe(false);
    expect(goal({ ...d, suppLog: { [D]: ['a', 'b'] } }, D, 'supplements')!.status.done).toBe(true);
  });

  it('a challenge goal appears only on days the run covers', () => {
    const d = startChallenge(base(), { templateId: 'custom', title: 'Mine', days: 3, rule: 'lenient', tasks: [{ id: 't', label: 'T', kind: 'tick' }] }, D, 'r');
    expect(goal(d, '2026-10-19', 'challenge:r')).toBeUndefined();
    expect(goal(d, D, 'challenge:r')!.status.done).toBe(false);
    const t = { ...d, challenges: [{ ...d.challenges[0], ticks: { [D]: ['t'] } }] };
    expect(goal(t, D, 'challenge:r')!.status.done).toBe(true);
    expect(goal(d, '2026-10-23', 'challenge:r')).toBeUndefined();
  });

  it('a fast counts on its end date only when it reached the target', () => {
    const started = startFast(base(), 16, `${D}T20:00:00`, 'f');
    expect(goal(started, D, 'fast')).toBeUndefined();
    expect(goal(endFast(started, '2026-10-21T10:00:00'), '2026-10-21', 'fast')!.status.done).toBe(false);
    expect(goal(endFast(started, '2026-10-21T13:00:00'), '2026-10-21', 'fast')!.status.done).toBe(true);
  });

  it('firstGoalDate is the earliest date with a done goal', () => {
    expect(firstGoalDate(base())).toBeNull();
    expect(firstGoalDate({ ...base(), water: { '2026-10-18': 2, '2026-10-19': 8, [D]: 8 } })).toBe('2026-10-19');
  });
});
