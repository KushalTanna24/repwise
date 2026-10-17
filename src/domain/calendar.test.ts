import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { addGoal, dayMarks, monthCells, nextGoal, removeGoal } from './calendar';
import { normalize } from './migrate';
import { addSupplement, toggleSupplement } from './supplements';
import { addWater } from './water';
import type { AppData } from './types';

const NOW = '2026-10-17T08:00:00.000Z';

describe('goals', () => {
  it('adds dated goals sorted by date and removes them', () => {
    let d = addGoal(emptyAppData(NOW), 'Bench 100 kg', '2027-03-01');
    d = addGoal(d, 'Lose 3 kg', '2026-12-01');
    expect(d.goals.map((g) => g.title)).toEqual(['Lose 3 kg', 'Bench 100 kg']);
    expect(nextGoal(d, '2026-10-17')).toMatchObject({ title: 'Lose 3 kg', daysLeft: 45 });
    d = removeGoal(d, d.goals[0].id);
    expect(d.goals.map((g) => g.title)).toEqual(['Bench 100 kg']);
  });

  it('rejects blank titles and bad dates', () => {
    const d = emptyAppData(NOW);
    expect(addGoal(d, ' ', '2027-01-01')).toBe(d);
    expect(addGoal(d, 'X', 'soon')).toBe(d);
  });

  it('nextGoal ignores past goals', () => {
    const d = addGoal(emptyAppData(NOW), 'Old', '2026-01-01');
    expect(nextGoal(d, '2026-10-17')).toBeNull();
  });

  it('older documents load with no goals', () => {
    const old = JSON.parse(JSON.stringify(emptyAppData(NOW))) as { goals?: unknown };
    delete old.goals;
    expect(normalize(old, NOW)!.goals).toEqual([]);
  });
});

describe('calendar', () => {
  it('builds a 6-week Monday-first grid for the month', () => {
    const cells = monthCells('2026-10');
    expect(cells).toHaveLength(42);
    expect(cells[0]).toEqual({ date: '2026-09-28', inMonth: false });
    expect(cells[3]).toEqual({ date: '2026-10-01', inMonth: true });
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it('marks workouts, water goal, full supplements and goals', () => {
    let d: AppData = emptyAppData(NOW);
    d.profile.waterGoal = 2;
    d = addWater(addWater(d, '2026-10-16', 1), '2026-10-16', 1);
    d = addSupplement(d, 'Creatine');
    d = toggleSupplement(d, '2026-10-16', 'creatine');
    d = addGoal(d, 'Bench 100', '2026-10-16');
    d.sessions = [
      {
        id: 's', planKey: null, splitId: null, sessionIndex: null, cycle: null, title: 'A',
        startedAt: '2026-10-16T06:00:00.000Z', finishedAt: '2026-10-16T07:00:00.000Z',
        exercises: [{ exerciseId: 'x', slotId: null, plan: null, rec: null, sets: [{ targetKg: null, targetReps: null, actualKg: 1, actualReps: 1, status: 'done' }] }],
      },
    ];
    expect(dayMarks(d, '2026-10-16')).toEqual({ workout: true, water: true, supps: true, goals: ['Bench 100'] });
    expect(dayMarks(d, '2026-10-15')).toEqual({ workout: false, water: false, supps: false, goals: [] });
  });
});
