import { describe, expect, it } from 'vitest';
import { allExercises, emptyAppData, getExercise } from '../catalogue';
import type { AppData, EquipmentKind } from '../types';
import { MAX_EXERCISES, isEligible } from './planner';
import { type DayFocus, FOCUS_LABEL, FOCUS_PATTERNS, dayGuide, suggestDay } from './splits/suggest';

const NOW = '2026-10-17T08:00:00.000Z';
const ALL: EquipmentKind[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
const FOCI = Object.keys(FOCUS_LABEL) as DayFocus[];
const MINUTES = [45, 60, 75, 90] as const;

function data(over: Partial<AppData['profile']> = {}): AppData {
  const d = emptyAppData(NOW);
  d.profile = { ...d.profile, equipment: ALL, ...over };
  return d;
}

describe('suggestDay', () => {
  it('has a label and patterns for every focus', () => {
    for (const f of FOCI) expect(FOCUS_PATTERNS[f].length).toBeGreaterThan(0);
  });

  for (const focus of FOCI) {
    describe(focus, () => {
      for (const m of MINUTES) {
        it(`fills ${m} min with eligible, unique exercises`, () => {
          const d = data({ sessionMinutes: m });
          const slots = suggestDay(d, focus);
          expect(slots).toHaveLength(MAX_EXERCISES[m]);
          const ids = slots.flatMap((s) => s.candidates);
          expect(new Set(ids).size).toBe(ids.length);
          for (const id of ids) expect(isEligible(getExercise(id, d.customExercises), d)).toBe(true);
        });
      }

      it('assigns roles and candidate counts', () => {
        const slots = suggestDay(data({ sessionMinutes: 90 }), focus);
        const anchors = focus === 'full' || focus === 'lower' ? 3 : 2;
        slots.forEach((s, i) => {
          expect(s.role).toBe(i < anchors ? 'anchor' : 'accessory');
          if (s.role === 'anchor') expect(s.candidates).toHaveLength(1);
          else expect(s.candidates.length).toBeLessThanOrEqual(3);
        });
      });
    });
  }

  it('puts a machine or dumbbell first for a beginner knee slot', () => {
    const d = data({ experience: 'beginner' });
    const slot = suggestDay(d, 'full').find((s) => s.pattern === 'knee')!;
    expect(['machine', 'dumbbell']).toContain(getExercise(slot.candidates[0], d.customExercises)!.equipment);
  });

  it('uses bodyweight only and skips patterns with nothing eligible', () => {
    const d = data({ equipment: ['bodyweight'], sessionMinutes: 90 });
    const slots = suggestDay(d, 'upper');
    for (const s of slots) for (const id of s.candidates) expect(getExercise(id, d.customExercises)!.equipment).toBe('bodyweight');
    expect(slots.length).toBeLessThanOrEqual(MAX_EXERCISES[90]);
    expect(allExercises(d).some((e) => e.equipment === 'bodyweight')).toBe(true);
  });

  it('never suggests an id in existing', () => {
    const ids = suggestDay(data(), 'push', ['bench-press']).flatMap((s) => s.candidates);
    expect(ids).not.toContain('bench-press');
  });
});

describe('dayGuide', () => {
  it('reads about right within the limit', () => {
    expect(dayGuide({ sessionMinutes: 60 }, 6)).toEqual({ limit: 6, over: false, text: '6 exercises · about right for 60 min' });
  });
  it('reads over the limit', () => {
    const g = dayGuide({ sessionMinutes: 60 }, 8);
    expect(g.over).toBe(true);
    expect(g.text).toBe('8 exercises · more than the 6 that usually fit 60 min');
  });
});
