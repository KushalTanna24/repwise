import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { AppData } from '../types';
import { findSlot, getSplit, listSplits } from './splits/registry';
import type { CustomSplit } from './types';

const custom = (id: CustomSplit['id'], createdAt: string, deletedAt?: string): CustomSplit => ({
  id,
  name: id,
  blurb: '1 day',
  custom: true,
  createdAt,
  updatedAt: createdAt,
  ...(deletedAt ? { deletedAt } : {}),
  sessions: [{ title: 'Day 1', slots: [{ id: 'cs-aaaaaaaa', pattern: 'core', role: 'accessory', candidates: ['plank'] }] }],
});

function data(): AppData {
  const d = emptyAppData('2026-10-17T08:00:00.000Z');
  d.customSplits = [custom('custom-b', '2026-10-02T00:00:00.000Z'), custom('custom-a', '2026-10-01T00:00:00.000Z'), custom('custom-gone', '2026-10-03T00:00:00.000Z', '2026-10-04T00:00:00.000Z')];
  return d;
}

describe('registry', () => {
  it('resolves built-ins and custom splits, including deleted ones', () => {
    const d = data();
    expect(getSplit(d, 'ppl')?.name).toBe('Push / Pull / Legs');
    expect(getSplit(d, 'custom-gone')?.id).toBe('custom-gone');
    expect(getSplit(d, 'custom-missing')).toBeUndefined();
  });

  it('lists custom splits without deleted, sorted by createdAt', () => {
    const l = listSplits(data());
    expect(l.builtIn).toHaveLength(4);
    expect(l.custom.map((s) => s.id)).toEqual(['custom-a', 'custom-b']);
  });

  it('finds slots in splits and finishers', () => {
    const d = data();
    expect(findSlot(d, 'full-body-abc', 'f-core')?.pattern).toBe('core');
    expect(findSlot(d, 'custom-a', 'cs-aaaaaaaa')?.pattern).toBe('core');
    expect(findSlot(d, null, 'x')).toBeUndefined();
    expect(findSlot(d, 'ppl', null)).toBeUndefined();
  });
});
