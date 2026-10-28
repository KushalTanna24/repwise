import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { bestSet, bmi, exerciseHistory, fromDisplay, latestWeight, localDate, parseNumber, periodStats, sessionPRs, toDisplay, weekStats } from './stats';
import type { AppData, SetRecord, WorkoutSession } from './types';

const NOW = '2026-10-17T08:00:00.000Z'; // Saturday

function sess(id: string, date: string, ex: Record<string, [number | null, number, SetRecord['status']?][]>): WorkoutSession {
  return {
    id,
    planKey: null,
    splitId: null,
    sessionIndex: null,
    cycle: null,
    title: 'T',
    startedAt: `${date}T06:00:00.000Z`,
    finishedAt: `${date}T07:00:00.000Z`,
    exercises: Object.entries(ex).map(([exerciseId, rows]) => ({
      exerciseId,
      slotId: null,
      plan: null,
      rec: null,
      sets: rows.map(([kg, reps, status = 'done']) => ({ targetKg: null, targetReps: null, actualKg: kg, actualReps: reps, status })),
    })),
  };
}
const withSessions = (sessions: WorkoutSession[], days = 3): AppData => {
  const d = emptyAppData(NOW);
  d.profile.daysPerWeek = days;
  d.sessions = sessions;
  return d;
};

describe('helpers', () => {
  it('parseNumber handles commas, blanks and junk', () => {
    expect(parseNumber('62,5')).toBe(62.5);
    expect(parseNumber(' 80 ')).toBe(80);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('-3')).toBeNull();
  });

  it('localDate uses local timezone', () => {
    expect(localDate('2026-10-16T20:00:00Z')).toBe('2026-10-17');
  });

  it('bmi uses kg / m²', () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmi(70, undefined)).toBeNull();
    expect(bmi(70, 0)).toBeNull();
  });

  it('toDisplay strips float noise', () => {
    expect(toDisplay(71.4 - 70, 'kg')).toBe(1.4);
  });

  it('unit conversion round-trips', () => {
    expect(toDisplay(100, 'lb')).toBe(220.5);
    expect(toDisplay(100, 'kg')).toBe(100);
    expect(fromDisplay(220.5, 'lb')).toBeCloseTo(100.02, 1);
  });

  it('latestWeight picks the newest date', () => {
    const d = emptyAppData(NOW);
    d.bodyweights = [
      { id: 'b', date: '2026-10-10', kg: 61 },
      { id: 'a', date: '2026-10-01', kg: 62 },
    ];
    expect(latestWeight(d)?.kg).toBe(61);
  });
});

describe('periodStats', () => {
  // NOW is Saturday 17 Oct 2026; the week starts Monday 12 Oct.
  const d = withSessions([
    sess('1', '2026-09-30', { x: [[1, 1]] }),
    sess('2', '2026-10-01', { x: [[1, 1], [1, 1]] }),
    sess('3', '2026-10-12', { x: [[1, 1], [1, 1, 'skipped']] }),
    sess('4', '2026-10-17', { x: [[1, 1], [1, 1], [1, 1]] }),
  ]);
  d.profile.waterGoal = 8;
  d.water = { '2026-09-30': 8, '2026-10-01': 5, '2026-10-12': 6, '2026-10-17': 3 };

  it('day counts only today against one workout and one day of water', () => {
    expect(periodStats(d, NOW, 'day')).toEqual({ sessions: 1, sets: 3, glasses: 3, targets: { sessions: 1, sets: 15, glasses: 8 } });
  });

  it('week counts from Monday, every ring against the week', () => {
    expect(periodStats(d, NOW, 'week')).toEqual({ sessions: 2, sets: 4, glasses: 9, targets: { sessions: 3, sets: 45, glasses: 56 } });
  });

  it('month counts from the 1st, targets scale with the days in the month', () => {
    // October has 31 days: 3 a week × 31/7 ≈ 13 workouts.
    expect(periodStats(d, NOW, 'month')).toEqual({ sessions: 3, sets: 6, glasses: 14, targets: { sessions: 13, sets: 195, glasses: 248 } });
  });

  it('an unfinished workout does not count', () => {
    const open = withSessions([{ ...sess('5', '2026-10-17', { x: [[1, 1]] }), finishedAt: null }]);
    expect(periodStats(open, NOW, 'day').sessions).toBe(0);
  });
});

describe('weekStats', () => {
  it('counts this week and the streak of weeks hitting the target', () => {
    const d = withSessions([
      sess('1', '2026-09-29', { x: [[1, 1]] }),
      sess('2', '2026-10-01', { x: [[1, 1]] }),
      sess('3', '2026-10-06', { x: [[1, 1]] }),
      sess('4', '2026-10-08', { x: [[1, 1]] }),
      sess('5', '2026-10-10', { x: [[1, 1]] }),
      sess('6', '2026-10-12', { x: [[1, 1], [1, 1, 'skipped']] }),
      sess('7', '2026-10-14', { x: [[1, 1]] }),
      sess('8', '2026-10-16', { x: [[1, 1]] }),
    ]);
    expect(weekStats(d, NOW)).toEqual({ sessions: 3, sets: 3, streakWeeks: 2 });
  });

  it('an unfinished current week does not break the streak', () => {
    const d = withSessions([
      sess('3', '2026-10-06', { x: [[1, 1]] }),
      sess('4', '2026-10-08', { x: [[1, 1]] }),
      sess('5', '2026-10-10', { x: [[1, 1]] }),
      sess('6', '2026-10-13', { x: [[1, 1]] }),
    ]);
    expect(weekStats(d, NOW).streakWeeks).toBe(1);
  });
});

describe('exercise history and records', () => {
  const d = withSessions([
    sess('a', '2026-10-01', { bench: [[60, 8], [60, 7], [62.5, 3, 'skipped']] }),
    sess('b', '2026-10-04', { bench: [[60, 10], [60, 9]] }),
    sess('c', '2026-10-08', { bench: [[62.5, 6], [60, 10]] }),
  ]);

  it('history uses done sets only', () => {
    const h = exerciseHistory(d, 'bench');
    expect(h.map((x) => [x.date, x.bestKg, x.bestReps, x.volume])).toEqual([
      ['2026-10-01', 60, 8, 900],
      ['2026-10-04', 60, 10, 1140],
      ['2026-10-08', 62.5, 6, 975],
    ]);
  });

  it('bestSet is heaviest load, then most reps', () => {
    expect(bestSet(d, 'bench')).toMatchObject({ kg: 62.5, reps: 6, date: '2026-10-08' });
  });

  it('sessionPRs flags a heavier load or more reps at the best load', () => {
    expect(sessionPRs(d, d.sessions[1])).toEqual([{ exerciseId: 'bench', kg: 60, reps: 10 }]);
    expect(sessionPRs(d, d.sessions[2])).toEqual([{ exerciseId: 'bench', kg: 62.5, reps: 6 }]);
    expect(sessionPRs(d, d.sessions[0])).toEqual([]);
  });
});
