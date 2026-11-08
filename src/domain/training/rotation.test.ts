import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { AppData } from '../types';
import { advanceRotation, clampRotation, currentRotation, restartAfterBreak, setSplit, skipDay } from './rotation';
import type { CustomSplit } from './types';

const two: CustomSplit = {
  id: 'custom-two',
  name: 'Two',
  blurb: '2 days',
  custom: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  sessions: [
    { title: 'A', slots: [] },
    { title: 'B', slots: [] },
  ],
};

function data(): AppData {
  const d = emptyAppData('2026-10-17T08:00:00.000Z');
  d.customSplits = [two];
  d.program.splitId = 'full-body-abc';
  return d;
}
const active = (d: AppData): AppData => ({ ...d, activeSession: {} as NonNullable<AppData['activeSession']> });

describe('rotation', () => {
  it('missing entry means day 1, cycle 1', () => {
    expect(currentRotation(data(), 'custom-two')).toEqual({ sessionIndex: 0, cycle: 1 });
  });

  it('advances and wraps into the next cycle, clearing the plan', () => {
    let d = data();
    d.program.rotation['full-body-abc'] = { sessionIndex: 2, cycle: 4 };
    d = advanceRotation(d, 'full-body-abc');
    expect(d.program.rotation['full-body-abc']).toEqual({ sessionIndex: 0, cycle: 5 });
    expect(d.plannedSession).toBeNull();
    expect(currentRotation(advanceRotation(data(), 'custom-two'), 'custom-two')).toEqual({ sessionIndex: 1, cycle: 1 });
  });

  it('skipDay advances once, and not during a workout or with no split', () => {
    expect(skipDay(data()).program.rotation['full-body-abc']).toEqual({ sessionIndex: 1, cycle: 1 });
    const a = active(data());
    expect(skipDay(a)).toBe(a);
    const n = { ...data(), program: { ...data().program, splitId: null } };
    expect(skipDay(n)).toBe(n);
  });

  it('setSplit is refused during a workout', () => {
    const a = active(data());
    expect(setSplit(a, 'ppl')).toBe(a);
    const d = setSplit(data(), 'ppl');
    expect(d.program.splitId).toBe('ppl');
    expect(d.plannedSession).toBeNull();
  });

  it('restartAfterBreak goes to day 1 of the next cycle', () => {
    const d = data();
    d.program.rotation['full-body-abc'] = { sessionIndex: 2, cycle: 2 };
    expect(restartAfterBreak(d, 'full-body-abc').program.rotation['full-body-abc']).toEqual({ sessionIndex: 0, cycle: 3 });
  });

  it('clampRotation caps the index and keeps the cycle', () => {
    const d = data();
    d.program.rotation['custom-two'] = { sessionIndex: 3, cycle: 4 };
    expect(clampRotation(d, 'custom-two').program.rotation['custom-two']).toEqual({ sessionIndex: 1, cycle: 4 });
  });
});
