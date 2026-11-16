import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../catalogue';
import type { AppData, WorkoutSession } from '../types';
import { newCustomSplit } from '../training';
import { needsOnboarding } from './gate';

const NOW = '2026-11-11T08:00:00.000Z';

const session: WorkoutSession = {
  id: 's1',
  planKey: null,
  splitId: null,
  sessionIndex: null,
  cycle: null,
  title: 'Full Body',
  startedAt: NOW,
  finishedAt: NOW,
  exercises: [],
};

describe('needsOnboarding', () => {
  it('is true for a brand-new document', () => {
    expect(needsOnboarding(emptyAppData(NOW))).toBe(true);
  });

  const cases: [string, (d: AppData) => AppData][] = [
    ['onboardedAt is set', (d) => ({ ...d, profile: { ...d.profile, onboardedAt: NOW } })],
    ['there is a session', (d) => ({ ...d, sessions: [session] })],
    ['there is a weigh-in', (d) => ({ ...d, bodyweights: [{ id: 'w', date: '2026-11-11', kg: 80 }] })],
    ['a split is chosen', (d) => ({ ...d, program: { ...d.program, splitId: 'ppl' } })],
    ['a custom split exists', (d) => ({ ...d, customSplits: [newCustomSplit(d, null, NOW).split] })],
  ];
  for (const [name, change] of cases) {
    it(`is false when ${name}`, () => expect(needsOnboarding(change(emptyAppData(NOW)))).toBe(false));
  }
});
