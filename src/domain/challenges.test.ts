import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { emptyAppData } from './catalogue';
import { habitStackDraft, seventyFiveDraft, type ChallengeDraft } from './challengeTemplates';
import { activeRuns, canStart, challengeScore, restartChallenge, runCoversDate, settleChallenges, startChallenge, taskDone, toggleTask } from './challenges';
import { addPhoto } from './photos';
import type { AppData, WorkoutSession } from './types';

const TODAY = '2026-10-27';
const base = () => emptyAppData(`${TODAY}T08:00:00`);
const custom = (rule: 'strict' | 'lenient', days = 30): ChallengeDraft => ({
  templateId: 'custom',
  title: 'Mine',
  days,
  rule,
  tasks: [{ id: 't', label: 'Do it', kind: 'tick' }],
});
const run = (d: AppData, id: string) => d.challenges.find((r) => r.id === id)!;
const dates = (from: string, n: number) => Array.from({ length: n }, (_, i) => dayjs(from).add(i, 'day').format('YYYY-MM-DD'));
/** Ticks task 't' on every date given. */
const ticked = (d: AppData, id: string, ds: string[]): AppData => ({
  ...d,
  challenges: d.challenges.map((r) => (r.id === id ? { ...r, ticks: Object.fromEntries(ds.map((x) => [x, ['t']])) } : r)),
});

describe('templates', () => {
  it('75-Day Challenge: 7 tasks, 15 glasses, strict, never called Hard', () => {
    const t = seventyFiveDraft();
    expect(t.tasks.map((x) => x.id)).toEqual(['workout', 'outdoor', 'water', 'diet', 'alcohol', 'read', 'photo']);
    expect(t.tasks.find((x) => x.id === 'water')!.target).toBe(15);
    expect([t.rule, t.days]).toEqual(['strict', 75]);
    expect(t.title).toBe('75-Day Challenge');
    expect(t.title).not.toMatch(/hard/i);
  });

  it('habit stack: one tick per habit, lenient, keeps the anchor', () => {
    const t = habitStackDraft('After coffee', ['Stretch', 'Journal'], 30);
    expect(t.tasks.map((x) => [x.id, x.label])).toEqual([
      ['h1', 'Stretch'],
      ['h2', 'Journal'],
    ]);
    expect([t.rule, t.days, t.anchor]).toEqual(['lenient', 30, 'After coffee']);
  });
});

describe('lifecycle', () => {
  it('at most 3 active runs', () => {
    let d = base();
    for (const id of ['a', 'b', 'c']) d = startChallenge(d, custom('lenient'), TODAY, id);
    expect(canStart(d)).toBe(false);
    expect(startChallenge(d, custom('lenient'), TODAY, 'd')).toBe(d);
    expect(activeRuns(d)).toHaveLength(3);
  });

  it('ticks only today and yesterday, never auto tasks', () => {
    const d = startChallenge(startChallenge(base(), custom('lenient'), '2026-10-20', 'a'), seventyFiveDraft(), '2026-10-20', 'b');
    expect(toggleTask(d, 'a', 't', '2026-10-25', TODAY)).toBe(d);
    expect(run(toggleTask(d, 'a', 't', '2026-10-26', TODAY), 'a').ticks['2026-10-26']).toEqual(['t']);
    const on = toggleTask(d, 'a', 't', TODAY, TODAY);
    expect(run(toggleTask(on, 'a', 't', TODAY, TODAY), 'a').ticks[TODAY]).toEqual([]);
    expect(toggleTask(d, 'b', 'water', TODAY, TODAY)).toBe(d);
  });

  it('auto tasks tick themselves from extras, runs and water', () => {
    let d = startChallenge(base(), seventyFiveDraft(), '2026-10-20', 'r');
    const task = (id: string) => run(d, 'r').tasks.find((t) => t.id === id)!;
    const done = (id: string) => taskDone(d, run(d, 'r'), task(id), TODAY);
    expect(done('workout')).toBe(false);
    d = { ...d, extras: [{ id: 'x', date: TODAY, type: 'mobility', minutes: 45 }] };
    expect([done('workout'), done('outdoor')]).toEqual([true, false]);
    d = { ...d, extras: [{ id: 'y', date: TODAY, type: 'run', minutes: 45 }] };
    expect(done('outdoor')).toBe(true);
    d = { ...d, water: { [TODAY]: 14 } };
    expect(done('water')).toBe(false);
    d = { ...d, water: { [TODAY]: 15 } };
    expect(done('water')).toBe(true);
  });

  it('a finished session counts for the workout task, an unfinished one does not', () => {
    const s: WorkoutSession = { id: 's', planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'T', startedAt: `${TODAY}T07:00:00`, finishedAt: `${TODAY}T08:00:00`, exercises: [] };
    const d = { ...startChallenge(base(), seventyFiveDraft(), TODAY, 'r'), sessions: [s] };
    const r = run(d, 'r');
    expect(taskDone(d, r, r.tasks[0], TODAY)).toBe(true);
    expect(taskDone({ ...d, sessions: [{ ...s, finishedAt: null }] }, r, r.tasks[0], TODAY)).toBe(false);
  });

  it('a photo task is done when a photo exists for that run and day', () => {
    const d = startChallenge(base(), seventyFiveDraft(), TODAY, 'r');
    const photo = run(d, 'r').tasks.find((t) => t.id === 'photo')!;
    expect(taskDone(d, run(d, 'r'), photo, TODAY)).toBe(false);
    const p = addPhoto(d, { id: 'p', date: TODAY, path: 'u/p.jpg', challengeId: 'r' });
    expect(taskDone(p, run(p, 'r'), photo, TODAY)).toBe(true);
  });

  it('strict: a locked incomplete day fails the run', () => {
    let d = startChallenge(base(), custom('strict'), '2026-10-20', 'r');
    d = ticked(d, 'r', ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-25']);
    const r = run(settleChallenges(d, TODAY), 'r');
    expect([r.status, r.failedDay, r.endedOn]).toEqual(['failed', 5, TODAY]);
  });

  it('strict: yesterday and today are still open, so they never fail it', () => {
    const d = ticked(startChallenge(base(), custom('strict'), '2026-10-24', 'r'), 'r', ['2026-10-24', '2026-10-25']);
    expect(settleChallenges(d, TODAY)).toBe(d);
  });

  it('restart begins again today and keeps old ticks', () => {
    let d = ticked(startChallenge(base(), custom('strict'), '2026-10-20', 'r'), 'r', ['2026-10-20']);
    d = settleChallenges(d, TODAY);
    const r = run(restartChallenge(d, 'r', TODAY), 'r');
    expect([r.status, r.startDate, r.restarts, r.failedDay, r.endedOn]).toEqual(['active', TODAY, 1, undefined, undefined]);
    expect(r.ticks['2026-10-20']).toEqual(['t']);
  });

  it('lenient: missed days are scored and the run continues', () => {
    const missed = ['2026-10-12', '2026-10-15', '2026-10-18'];
    const d = ticked(startChallenge(base(), custom('lenient'), '2026-10-10', 'r'), 'r', dates('2026-10-10', 16).filter((x) => !missed.includes(x)));
    const s = settleChallenges(d, TODAY);
    expect(run(s, 'r').status).toBe('active');
    // 10th..27th is 18 days; 10th..25th ticked except 3; 26th and 27th open.
    expect(challengeScore(s, run(s, 'r'), TODAY)).toEqual({ complete: 13, elapsed: 18, days: 30 });
  });

  it('a run whose last day locks complete is done', () => {
    const d = ticked(startChallenge(base(), custom('strict', 7), '2026-10-15', 'r'), 'r', dates('2026-10-15', 7));
    const r = run(settleChallenges(d, TODAY), 'r');
    expect([r.status, r.endedOn]).toEqual(['done', TODAY]);
  });

  it('a lenient run with misses still ends as done after its last day locks', () => {
    const d = ticked(startChallenge(base(), custom('lenient', 7), '2026-10-15', 'r'), 'r', ['2026-10-15']);
    expect(run(settleChallenges(d, TODAY), 'r').status).toBe('done');
  });

  it('a run starting tomorrow covers nothing yet and never fails', () => {
    const d = startChallenge(base(), custom('strict'), '2026-10-28', 'r');
    expect(runCoversDate(run(d, 'r'), TODAY)).toBe(false);
    expect(settleChallenges(d, TODAY)).toBe(d);
  });
});
