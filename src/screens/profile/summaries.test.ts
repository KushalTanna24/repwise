import { describe, expect, it } from 'vitest';
import { emptyAppData } from '@/domain/catalogue';
import { addGoal } from '@/domain/calendar';
import type { AppData } from '@/domain/types';
import { profileSummaries } from './summaries';

const NOW = '2026-10-17T08:00:00.000Z';
const ctx = { permission: 'default' as const, signedIn: false };
const base = (): AppData => emptyAppData(NOW);

describe('profileSummaries', () => {
  it('training shows split name, rotation and days', () => {
    const d = base();
    d.program.splitId = 'full-body-abc';
    d.profile.daysPerWeek = 5;
    expect(profileSummaries(d, ctx).training).toBe('Full Body A/B/C · 5×/wk');
    d.program.splitId = undefined as never;
    expect(profileSummaries(d, ctx).training).toBe('Not set');
  });

  it('goals counts', () => {
    let d = base();
    expect(profileSummaries(d, ctx).goals).toBe('None yet');
    d = addGoal(d, 'A', '2027-01-01');
    expect(profileSummaries(d, ctx).goals).toBe('1 goal');
    d = addGoal(d, 'B', '2027-02-01');
    expect(profileSummaries(d, ctx).goals).toBe('2 goals');
  });

  it('body shows water goal', () => {
    const d = base();
    d.profile.waterGoal = 8;
    expect(profileSummaries(d, ctx).body).toBe('8 glasses');
  });

  it('supps counts active only', () => {
    const d = base();
    d.supplements = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D', archived: true },
    ] as AppData['supplements'];
    expect(profileSummaries(d, ctx).supps).toBe('3 in stack');
    d.supplements = [];
    expect(profileSummaries(d, ctx).supps).toBe('Empty');
  });

  it('equipment', () => {
    const d = base();
    d.profile.equipment = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
    expect(profileSummaries(d, ctx).equipment).toBe('All equipment');
    d.profile.equipment = ['barbell', 'dumbbell', 'machine'];
    expect(profileSummaries(d, ctx).equipment).toBe('3 of 5');
  });

  it('reminders follow permission', () => {
    const d = base();
    expect(profileSummaries(d, { ...ctx, permission: 'granted' }).reminders).toBe('On');
    expect(profileSummaries(d, { ...ctx, permission: 'denied' }).reminders).toBe('Blocked');
    expect(profileSummaries(d, { ...ctx, permission: 'default' }).reminders).toBe('Off');
    expect(profileSummaries(d, { ...ctx, permission: 'unsupported' }).reminders).toBe('Off');
    d.profile.waterReminders = { on: true, from: 9, to: 21, everyHours: 2 };
    expect(profileSummaries(d, { ...ctx, permission: 'denied' }).reminders).toBe('Water on');
  });

  it('data shows workout count and no value is empty', () => {
    const d = base();
    expect(profileSummaries(d, ctx).data).toBe('0 workouts');
    for (const v of Object.values(profileSummaries(d, ctx))) expect(v.length).toBeGreaterThan(0);
  });
});

describe('4.3 rows', () => {
  const at = { ...ctx, today: '2026-10-27' };
  it('leave shows when it ends, or Off', () => {
    const d = base();
    expect(profileSummaries(d, at).leave).toBe('Off');
    expect(profileSummaries({ ...d, leave: [{ start: '2026-10-25', end: '2026-11-03' }] }, at).leave).toBe('On until 3 Nov');
    expect(profileSummaries({ ...d, leave: [{ start: '2026-10-25', end: null }] }, at).leave).toBe('On');
  });

  it('challenges counts active runs', () => {
    const d = base();
    expect(profileSummaries(d, at).challenges).toBe('None');
    const run = { id: 'r', templateId: 'custom' as const, title: 'X', startDate: '2026-10-27', days: 7, rule: 'lenient' as const, tasks: [], ticks: {}, status: 'active' as const, restarts: 0 };
    expect(profileSummaries({ ...d, challenges: [run, { ...run, id: 'q', status: 'done' }] }, at).challenges).toBe('1 active');
  });
});
