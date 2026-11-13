import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import { normalize } from '../migrate';
import { finishSession, startSession, updateSet } from '../session';
import type { AppData } from '../types';
import { ensurePlan } from './planner';
import { currentRotation } from './rotation';
import { deleteCustomSplit, newCustomSplit, saveCustomSplit, splitBlurb, validateSplit } from './splits/custom';
import { getSplit, listSplits } from './splits/registry';
import type { BuiltInSplitId, CustomSplit, Slot } from './types';

const NOW = '2026-10-17T08:00:00.000Z';
const LATER = '2026-10-18T08:00:00.000Z';
const BUILT_INS: BuiltInSplitId[] = ['full-body-abc', 'upper-lower', 'ppl', 'ppl-hybrid'];

const base = (): AppData => emptyAppData(NOW);
const slot = (id: string): Slot => ({ id, pattern: 'hpush', role: 'anchor', candidates: ['bench-press'] });
const day = (title: string, n = 1) => ({ title, slots: Array.from({ length: n }, (_, i) => slot(`cs-${title}${i}`)) });
function custom(days: number, id: CustomSplit['id'] = 'custom-mine'): CustomSplit {
  return {
    id,
    name: 'Mine',
    blurb: '',
    custom: true,
    createdAt: NOW,
    updatedAt: NOW,
    sessions: Array.from({ length: days }, (_, i) => day(`D${i + 1}`)),
  };
}

describe('newCustomSplit', () => {
  it.each(BUILT_INS)('copies %s with fresh slot ids', (id) => {
    const d = base();
    const src = getSplit(d, id)!;
    const { split } = newCustomSplit(d, id, NOW);
    expect(split.sessions.length).toBe(src.sessions.length);
    split.sessions.forEach((s, i) => {
      expect(s.title).toBe(src.sessions[i].title);
      expect(s.short).toBe(src.sessions[i].short);
      expect(s.slots.length).toBe(src.sessions[i].slots.length);
      s.slots.forEach((sl, j) => {
        const o = src.sessions[i].slots[j];
        expect(sl.id).toMatch(/^cs-[a-z0-9]{8}$/);
        expect(sl.id).not.toBe(o.id);
        expect(sl.role).toBe(o.role);
        expect(sl.pattern).toBe(o.pattern);
        expect(sl.candidates).toEqual(o.candidates);
      });
    });
    expect(split.name).toBe('My ' + src.name);
    expect(split.copiedFrom).toBe(id);
    expect(split.custom).toBe(true);
    expect(d.customSplits).toEqual([]);
  });

  it('blank draft', () => {
    const { split } = newCustomSplit(base(), null, NOW, 'custom-fixed');
    expect(split.id).toBe('custom-fixed');
    expect(split.name).toBe('My split');
    expect(split.sessions).toEqual([{ title: 'Day 1', slots: [] }]);
    expect(newCustomSplit(base(), null, NOW).split.id).toMatch(/^custom-.+/);
  });
});

describe('validateSplit', () => {
  const ok = () => newCustomSplit(base(), 'ppl', NOW).split;
  it('accepts a valid copy', () => expect(validateSplit(ok())).toBeNull());
  it('rejects each broken rule', () => {
    expect(validateSplit({ ...ok(), name: '' })).toBe('Give your split a name');
    expect(validateSplit({ ...ok(), sessions: [] })).toBe('A split needs 1 to 7 days');
    expect(validateSplit(custom(8))).toBe('A split needs 1 to 7 days');
    const s = ok();
    expect(validateSplit({ ...s, sessions: [{ title: '  ', slots: s.sessions[0].slots }] })).toBe('Give every day a name');
    expect(validateSplit({ ...s, sessions: [{ title: 'A', slots: [] }] })).toBe('Give every day at least one exercise');
    expect(validateSplit({ ...s, sessions: [day('A', 13)] })).toBe('Keep each day to 12 exercises or fewer');
  });
});

describe('splitBlurb', () => {
  it('joins short ?? title', () => {
    expect(splitBlurb({ ...custom(1), sessions: [day('Push'), { ...day('Pull'), short: 'P' }] })).toBe('2 days · Push / P');
    expect(splitBlurb(custom(1))).toBe('1 day · D1');
  });
});

describe('saveCustomSplit', () => {
  it('stores, sets blurb, replaces by id', () => {
    const { split } = newCustomSplit(base(), 'ppl', NOW, 'custom-a');
    let d = saveCustomSplit(base(), split, LATER);
    expect(d.customSplits).toHaveLength(1);
    expect(d.customSplits[0].blurb).toBe(splitBlurb(split));
    expect(d.customSplits[0].updatedAt).toBe(LATER);
    d = saveCustomSplit(d, { ...split, name: 'Renamed' }, LATER);
    expect(d.customSplits).toHaveLength(1);
    expect(d.customSplits[0].name).toBe('Renamed');
  });

  it('returns data unchanged when invalid', () => {
    const d = base();
    expect(saveCustomSplit(d, { ...custom(1), name: '' }, LATER)).toBe(d);
  });

  function activeAtDay3(): AppData {
    let d = base();
    d = saveCustomSplit(d, custom(3), NOW);
    d.program.splitId = 'custom-mine';
    d.program.rotation['custom-mine'] = { sessionIndex: 2, cycle: 3 };
    return d;
  }

  it('clamps rotation and clears plan for the active split', () => {
    let d = ensurePlan(activeAtDay3(), NOW);
    expect(d.plannedSession).not.toBeNull();
    d = saveCustomSplit(d, custom(2), LATER);
    expect(currentRotation(d, 'custom-mine')).toEqual({ sessionIndex: 1, cycle: 3 });
    expect(d.plannedSession).toBeNull();
  });

  it('Review Focus 1: leaves a running workout alone and finishing still works', () => {
    let d = startSession(ensurePlan(activeAtDay3(), NOW), NOW, 'run-1');
    expect(d.activeSession).not.toBeNull();
    d = updateSet(d, 0, 0, { actualKg: 60, actualReps: 5, status: 'done' });
    const running = d.activeSession;
    const saved = saveCustomSplit(d, custom(2), LATER);
    expect(saved.activeSession).toBe(running);
    const done = finishSession(saved, LATER);
    expect(done.sessions).toHaveLength(1);
    expect(currentRotation(done, 'custom-mine').sessionIndex).toBeLessThan(2);
  });

  it('Review Focus 5: inactive split clamps itself, active plan untouched', () => {
    let d = base();
    d = saveCustomSplit(d, custom(3), NOW);
    d.program.rotation['custom-mine'] = { sessionIndex: 2, cycle: 2 };
    d.program.splitId = 'ppl';
    d = ensurePlan(d, NOW);
    const plan = d.plannedSession;
    expect(plan).not.toBeNull();
    d = saveCustomSplit(d, custom(2), LATER);
    expect(currentRotation(d, 'custom-mine')).toEqual({ sessionIndex: 1, cycle: 2 });
    expect(d.plannedSession).toBe(plan);
  });
});

describe('deleteCustomSplit', () => {
  it('hides from lists but still resolves', () => {
    let d = saveCustomSplit(base(), custom(2), NOW);
    d = deleteCustomSplit(d, 'custom-mine', LATER);
    expect(listSplits(d).custom).toHaveLength(0);
    expect(getSplit(d, 'custom-mine')?.id).toBe('custom-mine');
  });

  it('active split: splitId and plan cleared', () => {
    let d = saveCustomSplit(base(), custom(2), NOW);
    d.program.splitId = 'custom-mine';
    d = ensurePlan(d, NOW);
    d = deleteCustomSplit(d, 'custom-mine', LATER);
    expect(d.program.splitId).toBeNull();
    expect(d.plannedSession).toBeNull();
  });

  it('blocked by a running workout', () => {
    let d = saveCustomSplit(base(), custom(2), NOW);
    d.program.splitId = 'custom-mine';
    d = startSession(ensurePlan(d, NOW), NOW, 'run-2');
    expect(d.activeSession).not.toBeNull();
    expect(deleteCustomSplit(d, 'custom-mine', LATER)).toBe(d);
  });
});

describe('normalize', () => {
  const v4 = (): Record<string, unknown> => JSON.parse(JSON.stringify(base()));

  it('fills customSplits', () => {
    const doc = v4();
    delete doc.customSplits;
    expect(normalize(doc, NOW)?.customSplits).toEqual([]);
  });

  it('drops an orphaned custom splitId', () => {
    const doc = v4();
    (doc.program as AppData['program']).splitId = 'custom-gone';
    const out = normalize(doc, NOW)!;
    expect(out.program.splitId).toBeNull();
    expect(out.plannedSession).toBeNull();
  });

  it('keeps a resolvable custom splitId; missing rotation is day 1', () => {
    const doc = v4();
    doc.customSplits = [custom(2)];
    (doc.program as AppData['program']).splitId = 'custom-mine';
    const out = normalize(doc, NOW)!;
    expect(out.program.splitId).toBe('custom-mine');
    expect(currentRotation(out, 'custom-mine')).toEqual({ sessionIndex: 0, cycle: 1 });
  });
});
