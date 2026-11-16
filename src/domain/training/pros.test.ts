import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, emptyAppData } from '../catalogue';
import type { AppData } from '../types';
import { validateSplit } from './splits/custom';
import { adoptProSplit, adoptedCopy } from './splits/adopt';
import { PRO_SPLITS, getProSplit } from './splits/pros';

const NOW = '2026-11-16T08:00:00.000Z';
const ids = new Set(BUILTIN_EXERCISES.map((e) => e.id));

function data(patch: Partial<AppData['profile']> = {}): AppData {
  const d = emptyAppData(NOW);
  return { ...d, profile: { ...d.profile, ...patch } };
}

describe('pro splits data', () => {
  it('has unique ids and covers every category', () => {
    expect(new Set(PRO_SPLITS.map((p) => p.id)).size).toBe(PRO_SPLITS.length);
    expect(new Set(PRO_SPLITS.map((p) => p.category))).toEqual(new Set(['bodybuilder', 'hollywood', 'athlete']));
  });

  it.each(PRO_SPLITS.map((p) => [p.id, p] as const))('%s only uses catalogue exercises and valid supersets', (_, pro) => {
    expect(pro.sessions.length).toBeGreaterThan(0);
    expect(pro.techniques.length).toBeGreaterThan(0);
    const slotIds = pro.sessions.flatMap((s) => s.slots.map((x) => x.id));
    expect(new Set(slotIds).size).toBe(slotIds.length);
    for (const day of pro.sessions) {
      expect(day.slots.length).toBeGreaterThan(0);
      expect(day.slots.length).toBeLessThanOrEqual(12);
      for (const slot of day.slots) for (const c of slot.candidates) expect(ids, `${slot.id}: ${c}`).toContain(c);
      const here = new Set(day.slots.map((x) => x.id));
      for (const [a, b] of day.supersets ?? []) {
        expect(here).toContain(a);
        expect(here).toContain(b);
      }
    }
  });

  it('looks splits up by id', () => {
    expect(getProSplit('pro-arnold')?.person).toBe('Arnold Schwarzenegger');
    expect(getProSplit('pro-nobody')).toBeUndefined();
  });
});

describe('adoptProSplit', () => {
  const arnold = getProSplit('pro-arnold')!;

  it('copies every pro split into a valid custom split with full equipment', () => {
    for (const pro of PRO_SPLITS) {
      const { split } = adoptProSplit(data({ sessionMinutes: 90 }), pro, NOW, { fit: false });
      expect(validateSplit(split), pro.id).toBeNull();
      expect(split.copiedFrom).toBe(pro.id);
      expect(split.name).toBe(pro.name);
    }
  });

  it('keeps the original exercises when nothing needs to change', () => {
    const { split, changes } = adoptProSplit(data({ sessionMinutes: 90, daysPerWeek: 6 }), arnold, NOW, { fit: true });
    expect(changes).toEqual([]);
    expect(split.sessions[0].slots[0].candidates[0]).toBe('bench-press');
    expect(split.sessions).toHaveLength(3);
  });

  it('falls back to equipment the user has and says so', () => {
    const { split, changes } = adoptProSplit(data({ equipment: ['dumbbell', 'bodyweight'], sessionMinutes: 90, daysPerWeek: 6 }), arnold, NOW, { fit: false });
    expect(split.sessions[0].slots[0].candidates[0]).toBe('db-bench-press');
    expect(changes).toContain('Chest & Back: Dumbbell bench press instead of Bench press');
    expect(validateSplit(split)).toBeNull();
  });

  it('never repeats an exercise within a day', () => {
    for (const pro of PRO_SPLITS) {
      const { split } = adoptProSplit(data({ equipment: ['bodyweight'], sessionMinutes: 90 }), pro, NOW, { fit: false });
      for (const day of split.sessions) {
        const firsts = day.slots.map((s) => s.candidates[0]);
        expect(new Set(firsts).size, `${pro.id} ${day.title}`).toBe(firsts.length);
      }
    }
  });

  it('trims extras from the end to fit the session, keeping mains', () => {
    const { split, changes } = adoptProSplit(data({ sessionMinutes: 45, daysPerWeek: 6 }), arnold, NOW, { fit: true });
    const chestBack = split.sessions[0].slots;
    expect(chestBack).toHaveLength(5);
    expect(chestBack.filter((s) => s.role === 'anchor')).toHaveLength(2);
    expect(changes[0]).toBe('Chest & Back: left out Straight-arm pulldown, Hanging knee raise to fit 45 min');
  });

  it('keeps everything when asked not to fit', () => {
    const { split } = adoptProSplit(data({ sessionMinutes: 45 }), arnold, NOW, { fit: false });
    expect(split.sessions[0].slots).toHaveLength(7);
  });

  it('explains how the rotation fits a different weekly schedule', () => {
    const { changes } = adoptProSplit(data({ sessionMinutes: 90, daysPerWeek: 3 }), arnold, NOW, { fit: true });
    expect(changes).toEqual(['Arnold ran it 6 days a week; you train 3. Each day once a week']);
  });

  it('finds an existing live copy', () => {
    const d = data();
    const { split } = adoptProSplit(d, arnold, NOW, { fit: true });
    expect(adoptedCopy({ ...d, customSplits: [split] }, arnold)?.id).toBe(split.id);
    expect(adoptedCopy({ ...d, customSplits: [{ ...split, deletedAt: NOW }] }, arnold)).toBeUndefined();
  });
});
