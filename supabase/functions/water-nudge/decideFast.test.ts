import { describe, expect, it } from 'vitest';
import { FAST_MILESTONES_H as APP_MILESTONES, FAST_PHASES as APP_PHASES } from '../../../src/domain/fasting.ts';
import { decideFast, FAST_MILESTONES_H, FAST_PHASES } from './decideFast.ts';

const NOW = new Date('2026-10-27T12:00:00Z');
const startedHoursAgo = (h: number, target = 16, endedAt: string | null = null) => ({
  fasts: [{ id: 'f', startedAt: new Date(NOW.getTime() - h * 3_600_000).toISOString(), endedAt, targetHours: target }],
});

describe('decideFast', () => {
  it('matches the app milestones and phases', () => {
    expect(FAST_MILESTONES_H).toEqual(APP_MILESTONES);
    expect(FAST_PHASES).toEqual(APP_PHASES);
  });

  it('sends once a milestone passed within the last hour', () => {
    expect(decideFast({ now: NOW, doc: startedHoursAgo(11.5) }).send).toBe(false);
    expect(decideFast({ now: NOW, doc: startedHoursAgo(12.2) })).toEqual({ send: true, title: '12 hours in', body: 'Fat burning.', url: '/#/today', topic: 'fast' });
  });

  it('the target milestone says the fast is complete', () => {
    expect(decideFast({ now: NOW, doc: startedHoursAgo(16.1, 16) })).toMatchObject({ send: true, title: 'Fast complete', body: '16 hours done. Your fast hit its target.' });
    expect(decideFast({ now: NOW, doc: startedHoursAgo(24.3, 24) })).toMatchObject({ title: 'Fast complete' });
  });

  it('a fast left running past 36h sends nothing more', () => {
    expect(decideFast({ now: NOW, doc: startedHoursAgo(40, 36) }).send).toBe(false);
  });

  it('an ended fast or a missing doc sends nothing', () => {
    expect(decideFast({ now: NOW, doc: startedHoursAgo(12.2, 16, NOW.toISOString()) }).send).toBe(false);
    expect(decideFast({ now: NOW, doc: null }).send).toBe(false);
  });
});
