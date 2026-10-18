import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { region, suggestNext } from './flow';
import { ensurePlan } from './planner';
import { confirmSet, skipExercise, startSession, updateSet } from './session';
import type { AppData } from './types';

const T0 = '2026-10-17T08:00:00.000Z';
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000).toISOString();

function started(): AppData {
  const d = emptyAppData(T0);
  d.program.splitId = 'full-body-abc';
  return startSession(ensurePlan(d), T0, 'w1');
}
const tick = (d: AppData, ex: number, set: number, sec: number) => confirmSet(updateSet(d, ex, set, { actualKg: 40, actualReps: 8 }), ex, set, at(sec));
const next = (d: AppData, sec: number) => suggestNext(d.activeSession!, d.customExercises, at(sec));

describe('region', () => {
  it('groups patterns into body areas', () => {
    expect(['knee', 'hip', 'calves'].map((p) => region(p as never))).toEqual(['legs', 'legs', 'legs']);
    expect(region('hpush')).toBe('push');
    expect(region('vpull')).toBe('pull');
    expect(region('core')).toBe('other');
  });
});

describe('suggestNext', () => {
  it('starts with the first main lift', () => {
    expect(next(started(), 0)).toEqual({ exIdx: 0, setIdx: 0 });
  });

  it('after a leg set it moves to a different body area', () => {
    const d = tick(started(), 0, 0, 60); // back squat
    const s = next(d, 70)!;
    expect(s.exIdx).not.toBe(0);
    expect(s).toEqual({ exIdx: 1, setIdx: 0 }); // bench press: push, never done, main lift
  });

  it('prefers a rested exercise over one still recovering', () => {
    let d = tick(started(), 1, 0, 0); // bench at 0 s
    d = tick(d, 0, 0, 100); // squat at 100 s; last area is legs
    d = tick(d, 2, 0, 110); // row at 110 s; last area is pull
    // At 130 s: bench rested 130 s (< 150), squat 30 s; neither ready.
    // Leg curl (legs accessory) never done: ready. Not the same area as the row.
    expect(next(d, 130)).toEqual({ exIdx: 3, setIdx: 0 });
  });

  it('ignores skipped exercises and returns null when nothing is left', () => {
    let d = started();
    const n = d.activeSession!.exercises.length;
    for (let i = 1; i < n; i++) d = skipExercise(d, i);
    expect(next(d, 0)!.exIdx).toBe(0);
    d = skipExercise(d, 0);
    expect(next(d, 0)).toBeNull();
  });
});
