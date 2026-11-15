import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { getSplit } from './training';
import { describeSplit } from './splitView';

const NOW = '2026-11-15T08:00:00.000Z';

describe('describeSplit', () => {
  it('lists each day with its muscles and exercises, main lifts first-class', () => {
    const d = emptyAppData(NOW);
    const days = describeSplit(d, getSplit(d, 'full-body-abc')!);
    expect(days.map((x) => x.title)).toEqual(['Full Body A', 'Full Body B', 'Full Body C']);
    const a = days[0];
    expect(a.exercises.length).toBeGreaterThan(3);
    expect(a.exercises.some((e) => e.main)).toBe(true);
    expect(a.exercises[0].rx).toMatch(/^\d+ × \d+–\d+$/);
    expect(a.muscles).toMatch(/^[A-Z]/);
    expect(a.muscles).toContain('quads');
  });

  it('uses an exercise your equipment allows, and says when none fits', () => {
    const d = emptyAppData(NOW);
    const bodyweight = { ...d, profile: { ...d.profile, equipment: ['bodyweight' as const] } };
    const days = describeSplit(bodyweight, getSplit(d, 'full-body-abc')!);
    for (const e of days.flatMap((x) => x.exercises)) if (e.name !== 'No option for your equipment') expect(e.equipment).toBe('bodyweight');
  });

  it('shows cardio in minutes', () => {
    const d = emptyAppData(NOW);
    const split = { id: 'custom-x' as const, name: 'X', blurb: '', custom: true as const, createdAt: NOW, updatedAt: NOW, sessions: [{ title: 'Cardio', slots: [{ id: 's', pattern: 'cardio' as const, role: 'accessory' as const, candidates: ['bike'] }] }] };
    expect(describeSplit(d, split)[0].exercises[0]).toMatchObject({ name: 'Bike', rx: '15 min' });
  });
});
