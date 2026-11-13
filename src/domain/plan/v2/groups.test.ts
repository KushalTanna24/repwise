import { describe, expect, it } from 'vitest';
import { FOCUS_GROUPS, GROUPS, GROUP_LABEL, MAJOR, focusGroups } from './groups';

describe('v2 groups', () => {
  it('maps focus areas to fine groups', () => {
    expect(FOCUS_GROUPS.shoulders).toEqual(['side-delts', 'rear-delts']);
    expect(FOCUS_GROUPS.chest).toEqual(['upper-chest', 'chest']);
    expect(FOCUS_GROUPS.back).toEqual(['lats', 'upper-back']);
    expect(FOCUS_GROUPS['traps-neck']).toEqual(['traps', 'neck']);
    expect(FOCUS_GROUPS.legs).toEqual(['quads', 'hamstrings', 'calves']);
    expect(FOCUS_GROUPS.arms).toEqual(['biceps', 'triceps']);
    expect(FOCUS_GROUPS['side-delts']).toEqual(['side-delts']);
    expect([...focusGroups(['side-delts', 'lats'])]).toEqual(['side-delts', 'lats']);
    expect(focusGroups(undefined).size).toBe(0);
  });

  it('labels every group and has 17', () => {
    expect(GROUPS).toHaveLength(17);
    for (const g of GROUPS) expect(GROUP_LABEL[g]).toMatch(/^[A-Z]/);
    expect(GROUP_LABEL['side-delts']).toBe('Side delts');
  });

  it('marks the six major groups', () => {
    expect([...MAJOR].sort()).toEqual(['chest', 'glutes', 'hamstrings', 'lats', 'quads', 'upper-back']);
  });
});
