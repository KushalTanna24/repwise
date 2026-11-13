import { describe, expect, it } from 'vitest';
import type { CustomSplit } from '../../training';
import { NOW, dataWith, daysAgo, sessionOn, weekDay } from './fixtures';
import { readHistory } from './history';

const twicePerWeek = (weeks: number, ex: Parameters<typeof sessionOn>[1]) =>
  Array.from({ length: weeks }, (_, w) => [sessionOn(weekDay(w + 1, 1), ex), sessionOn(weekDay(w + 1, 3), ex)]).flat();

describe('readHistory', () => {
  it('does not qualify with under 3 good weeks', () => {
    const d = dataWith(twicePerWeek(2, [{ id: 'bench-press', kg: 60, reps: 8, n: 3 }]));
    expect(readHistory(d, NOW).qualifies).toBe(false);
  });

  it('qualifies with 3 weeks of 2 sessions', () => {
    const d = dataWith(twicePerWeek(3, [{ id: 'bench-press', kg: 60, reps: 8, n: 3 }]));
    expect(readHistory(d, NOW).qualifies).toBe(true);
  });

  it('baseline counts primary 1 and secondary 0.5 over 6 weeks', () => {
    const d = dataWith(twicePerWeek(6, [{ id: 'incline-db-press', kg: 24, reps: 10, n: 3 }]));
    const h = readHistory(d, NOW);
    expect(h.baseline['upper-chest']).toBe(6);
    expect(h.baseline.triceps).toBe(3);
    expect(h.baseline.quads).toBe(0);
  });

  it('ignores unfinished sessions and pending sets', () => {
    const d = dataWith([
      ...twicePerWeek(6, [{ id: 'incline-db-press', kg: 24, reps: 10, n: 3, pending: 2 }]),
      sessionOn(weekDay(1, 5), [{ id: 'incline-db-press', kg: 24, reps: 10, n: 6 }], { finished: false }),
    ]);
    expect(readHistory(d, NOW).baseline['upper-chest']).toBe(6);
  });

  it('flags a stalled lift', () => {
    const kgs: [number, number][] = [[49, 8], [42, 9], [35, 10], [28, 11], [21, 11], [14, 11], [7, 11]];
    const d = dataWith(kgs.map(([ago, kg]) => sessionOn(daysAgo(ago), [{ id: 'db-lateral-raise', kg, reps: 12, n: 3 }])));
    const t = readHistory(d, NOW).trend['side-delts'];
    expect(t?.flatWeeks).toBe(4);
    expect(t?.change).toBeGreaterThan(0.3);
  });

  it('marks a rising lift as liked', () => {
    const d = dataWith([[21, 50], [14, 55], [7, 60]].map(([ago, kg]) => sessionOn(daysAgo(ago), [{ id: 'hip-thrust', kg, reps: 10, n: 3 }])));
    expect(readHistory(d, NOW).liked.has('hip-thrust')).toBe(true);
  });

  it('survives sessions with no done sets and null loads', () => {
    const d = dataWith(twicePerWeek(6, [{ id: 'bench-press', kg: null, reps: null, n: 0, pending: 3 }]));
    const h = readHistory(d, NOW);
    for (const v of Object.values(h.baseline)) expect(Number.isFinite(v)).toBe(true);
    expect(h.baseline.chest).toBe(0);
    expect(Object.keys(h.trend)).toEqual([]);
  });

  it('marks skipped-three-times exercises as avoided', () => {
    const d = dataWith([21, 14, 7].map((ago) => sessionOn(daysAgo(ago), [{ id: 'hip-thrust', kg: null, reps: null, n: 0, skipped: true }])));
    expect(readHistory(d, NOW).avoided.has('hip-thrust')).toBe(true);
  });

  it('marks a slot pick that keeps getting swapped out as avoided', () => {
    const split: CustomSplit = {
      id: 'custom-x',
      name: 'X',
      blurb: '',
      custom: true,
      createdAt: NOW,
      updatedAt: NOW,
      sessions: [{ title: 'A', slots: [{ id: 'slot-1', pattern: 'hpush', role: 'accessory', candidates: ['pec-deck', 'cable-fly'] }] }],
    };
    const d = { ...dataWith([21, 14, 7].map((ago) => sessionOn(daysAgo(ago), [{ id: 'cable-fly', kg: 15, reps: 12, n: 3, slotId: 'slot-1' }], { splitId: 'custom-x' }))), customSplits: [split] };
    expect(readHistory(d, NOW).avoided.has('pec-deck')).toBe(true);
  });

  it('adherence and finish rate', () => {
    const d = dataWith(
      Array.from({ length: 6 }, (_, i) =>
        sessionOn(daysAgo(i * 3 + 1), [
          { id: 'bench-press', kg: 60, reps: 8, n: 3 },
          { id: 'cable-fly', kg: 15, reps: 12, n: i % 2 ? 0 : 3, pending: i % 2 ? 3 : 0 },
        ]),
      ),
      { daysPerWeek: 3 },
    );
    const h = readHistory(d, NOW);
    expect(h.adherence).toBeCloseTo(6 / 24);
    expect(h.finishRate).toBe(0.75);
  });

  it('finish rate is null with under 6 sessions', () => {
    expect(readHistory(dataWith([sessionOn(daysAgo(1), [{ id: 'bench-press', kg: 60, reps: 8, n: 3 }])]), NOW).finishRate).toBeNull();
  });
});
