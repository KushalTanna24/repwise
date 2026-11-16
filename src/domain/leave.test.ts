import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { currentLeave, endLeave, onLeave, startLeave } from './leave';
import type { AppData } from './types';

const TODAY = '2026-10-27';
const base = () => emptyAppData(`${TODAY}T08:00:00`);
const ok = (r: AppData | { error: string }) => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('leave', () => {
  it('backdates at most 30 days', () => {
    expect(startLeave(base(), '2026-09-26', null, TODAY)).toEqual({ error: 'Leave can start at most 30 days ago.' });
    expect(ok(startLeave(base(), '2026-09-27', null, TODAY)).leave).toEqual([{ start: '2026-09-27', end: null }]);
  });

  it('rejects an end before the start', () => {
    expect(startLeave(base(), TODAY, '2026-10-26', TODAY)).toEqual({ error: 'End date is before the start.' });
  });

  it('merges overlapping and touching ranges', () => {
    const d = ok(startLeave(base(), '2026-10-20', '2026-10-25', TODAY));
    expect(ok(startLeave(d, '2026-10-24', '2026-11-02', TODAY)).leave).toEqual([{ start: '2026-10-20', end: '2026-11-02' }]);
    expect(ok(startLeave(d, '2026-10-26', '2026-10-28', TODAY)).leave).toEqual([{ start: '2026-10-20', end: '2026-10-28' }]);
  });

  it('open-ended leave covers every later date', () => {
    const d = ok(startLeave(base(), '2026-10-20', null, TODAY));
    expect([onLeave(d, '2026-10-19'), onLeave(d, '2026-10-20'), onLeave(d, '2027-01-01')]).toEqual([false, true, true]);
    expect(currentLeave(d, TODAY)).toEqual({ start: '2026-10-20', end: null });
  });

  it('ending leave closes it at yesterday, or removes it if it began today', () => {
    expect(endLeave(ok(startLeave(base(), '2026-10-20', null, TODAY)), TODAY).leave).toEqual([{ start: '2026-10-20', end: '2026-10-26' }]);
    expect(endLeave(ok(startLeave(base(), TODAY, null, TODAY)), TODAY).leave).toEqual([]);
    expect(currentLeave(base(), TODAY)).toBeNull();
  });
});
