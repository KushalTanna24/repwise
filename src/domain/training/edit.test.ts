import { describe, expect, it } from 'vitest';
import type { CustomSplit, Slot } from './types';
import { addAlternate, addDay, addEntry, fillDay, moveDay, moveEntry, removeAlternate, removeDay, removeEntry, renameDay, setRole } from './splits/edit';

const slot = (id: string, cands: string[], role: Slot['role'] = 'accessory'): Slot => ({ id, pattern: 'knee', role, candidates: cands });
const mk = (days: Slot[][]): CustomSplit => ({
  id: 'custom-x', custom: true, name: 'T', blurb: '', createdAt: 'a', updatedAt: 'a',
  sessions: days.map((slots, i) => ({ title: `D${i}`, slots })),
});
const ex = (id: string) => ({ id, pattern: 'hip' as const });

describe('days', () => {
  it('addDay adds Day n and refuses at 7', () => {
    const s = mk([[]]);
    expect(addDay(s).sessions[1]).toEqual({ title: 'Day 2', slots: [] });
    expect(s.sessions).toHaveLength(1);
    const full = mk([[], [], [], [], [], [], []]);
    expect(addDay(full)).toBe(full);
  });
  it('removeDay refuses the last day', () => {
    const one = mk([[]]);
    expect(removeDay(one, 0)).toBe(one);
    expect(removeDay(mk([[], []]), 0).sessions).toHaveLength(1);
  });
  it('moveDay reorders keeping slot ids; refuses no-ops', () => {
    const s = mk([[slot('cs-a', ['a'])], [slot('cs-b', ['b'])], [slot('cs-c', ['c'])]]);
    const m = moveDay(s, 0, 2);
    expect(m.sessions.map((d) => d.title)).toEqual(['D1', 'D2', 'D0']);
    expect(m.sessions[2]!.slots[0]!.id).toBe('cs-a');
    expect(moveDay(s, 1, 1)).toBe(s);
    expect(moveDay(s, 0, 5)).toBe(s);
  });
  it('renameDay', () => {
    const s = mk([[]]);
    expect(renameDay(s, 0, 'Push').sessions[0]!.title).toBe('Push');
    expect(renameDay(s, 0, 'D0')).toBe(s);
  });
});

describe('entries', () => {
  it('addEntry builds a slot', () => {
    const r = addEntry(mk([[]]), 0, ex('rdl'), 'anchor');
    expect(r.sessions[0]!.slots[0]).toEqual({ id: expect.stringMatching(/^cs-/), role: 'anchor', pattern: 'hip', candidates: ['rdl'] });
    expect(addEntry(mk([[]]), 0, ex('rdl')).sessions[0]!.slots[0]!.role).toBe('accessory');
  });
  it('addEntry refused at 12, and for a main or alternate duplicate', () => {
    const twelve = mk([Array.from({ length: 12 }, (_, i) => slot(`cs-${i}`, [`e${i}`]))]);
    expect(addEntry(twelve, 0, ex('new'))).toBe(twelve);
    const s = mk([[slot('cs-a', ['main', 'alt'])]]);
    expect(addEntry(s, 0, ex('main'))).toBe(s);
    expect(addEntry(s, 0, ex('alt'))).toBe(s);
  });
  it('removeEntry and moveEntry', () => {
    const s = mk([[slot('cs-a', ['a']), slot('cs-b', ['b'])]]);
    expect(removeEntry(s, 0, 0).sessions[0]!.slots.map((x) => x.id)).toEqual(['cs-b']);
    expect(removeEntry(s, 0, 9)).toBe(s);
    expect(moveEntry(s, 0, 0, 1).sessions[0]!.slots.map((x) => x.id)).toEqual(['cs-b', 'cs-a']);
    expect(moveEntry(s, 0, 0, 0)).toBe(s);
  });
});

describe('roles and alternates', () => {
  it('setRole anchor drops alternates', () => {
    const s = mk([[slot('cs-a', ['m', 'x', 'y'])]]);
    const r = setRole(s, 0, 0, 'anchor');
    expect(r.sessions[0]!.slots[0]!.candidates).toEqual(['m']);
    expect(r.sessions[0]!.slots[0]!.role).toBe('anchor');
    expect(setRole(r, 0, 0, 'anchor')).toBe(r);
  });
  it('addAlternate rules', () => {
    const s = mk([[slot('cs-a', ['m']), slot('cs-b', ['n'], 'anchor')]]);
    const a = addAlternate(s, 0, 0, 'x');
    expect(a.sessions[0]!.slots[0]!.candidates).toEqual(['m', 'x']);
    expect(addAlternate(s, 0, 1, 'x')).toBe(s);
    expect(addAlternate(s, 0, 0, 'm')).toBe(s);
    expect(addAlternate(s, 0, 0, 'n')).toBe(s);
    const two = addAlternate(a, 0, 0, 'y');
    expect(addAlternate(two, 0, 0, 'z')).toBe(two);
  });
  it('removeAlternate never removes the main exercise', () => {
    const s = mk([[slot('cs-a', ['m', 'x'])]]);
    expect(removeAlternate(s, 0, 0, 'x').sessions[0]!.slots[0]!.candidates).toEqual(['m']);
    expect(removeAlternate(s, 0, 0, 'm')).toBe(s);
    expect(removeAlternate(s, 0, 0, 'zz')).toBe(s);
  });
});

describe('fillDay', () => {
  it('fills an empty day only', () => {
    const s = mk([[], [slot('cs-a', ['a'])]]);
    const fill = [slot('cs-n', ['n'])];
    expect(fillDay(s, 0, fill).sessions[0]!.slots).toEqual(fill);
    expect(fillDay(s, 1, fill)).toBe(s);
    expect(fillDay(s, 0, [])).toBe(s);
  });
});
