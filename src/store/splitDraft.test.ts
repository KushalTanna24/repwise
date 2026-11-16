import { beforeEach, describe, expect, it } from 'vitest';
import type { CustomSplit } from '@/domain/training';
import { useSplitDraft } from './splitDraft';

const split: CustomSplit = { id: 'custom-x', custom: true, name: 'T', blurb: '', createdAt: 'a', updatedAt: 'a', sessions: [{ title: 'Day 1', slots: [] }] };

beforeEach(() => useSplitDraft.getState().close());

describe('useSplitDraft', () => {
  it('open sets the draft and clears dirty and focus', () => {
    useSplitDraft.getState().setFocus(0, 'push');
    useSplitDraft.getState().open(split);
    const s = useSplitDraft.getState();
    expect(s.draft).toBe(split);
    expect(s.dirty).toBe(false);
    expect(s.focus).toEqual({});
  });
  it('a refused edit leaves dirty false, an accepted one sets it', () => {
    useSplitDraft.getState().open(split);
    useSplitDraft.getState().edit((d) => d);
    expect(useSplitDraft.getState().dirty).toBe(false);
    useSplitDraft.getState().edit((d) => ({ ...d, name: 'N' }));
    expect(useSplitDraft.getState().dirty).toBe(true);
    expect(useSplitDraft.getState().draft?.name).toBe('N');
  });
  it('edit is a no-op without a draft', () => {
    useSplitDraft.getState().edit((d) => ({ ...d, name: 'N' }));
    expect(useSplitDraft.getState().draft).toBeNull();
    expect(useSplitDraft.getState().dirty).toBe(false);
  });
  it('close clears everything', () => {
    useSplitDraft.getState().open(split);
    useSplitDraft.getState().setFocus(0, 'pull');
    useSplitDraft.getState().edit((d) => ({ ...d, name: 'N' }));
    useSplitDraft.getState().close();
    expect(useSplitDraft.getState()).toMatchObject({ draft: null, dirty: false, focus: {} });
  });
});
