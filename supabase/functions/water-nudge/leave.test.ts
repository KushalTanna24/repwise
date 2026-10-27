import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../../../src/domain/catalogue.ts';
import { onLeave } from '../../../src/domain/leave.ts';
import { onLeaveDoc } from './leave.ts';

describe('onLeaveDoc', () => {
  it('matches the app for closed and open-ended ranges', () => {
    const d = { ...emptyAppData('2026-10-27T08:00:00Z'), leave: [{ start: '2026-10-10', end: '2026-10-12' }, { start: '2026-10-20', end: null }] };
    for (const date of ['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-20', '2027-01-01']) expect(onLeaveDoc(d, date)).toBe(onLeave(d, date));
  });

  it('a doc without leave is never on leave', () => {
    expect(onLeaveDoc({}, '2026-10-27')).toBe(false);
    expect(onLeaveDoc(null, '2026-10-27')).toBe(false);
  });
});
