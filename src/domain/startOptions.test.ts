import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { startSession } from './session';
import { applyStartMode, sessionMinutes, startChoices } from './startOptions';
import { ensurePlan, setSplit } from './training';
import type { AppData } from './types';

const NOW = '2026-11-15T08:00:00.000Z';

function ready(focus: AppData['profile']['focus'] = ['side-delts']): AppData {
  const d = emptyAppData(NOW);
  const withProfile = { ...d, profile: { ...d.profile, sessionMinutes: 60 as const, focus } };
  return ensurePlan(setSplit(withProfile, 'full-body-abc'), NOW);
}

describe('start options', () => {
  it('estimates minutes like the workout clock, plus a warm-up', () => {
    const d = startSession(ready(), NOW);
    const s = d.activeSession!;
    const expected = 5 + s.exercises.reduce((t, e) => t + e.sets.length * (40 + (e.plan?.restSec ?? 90)), 0) / 60;
    expect(sessionMinutes(s)).toBe(Math.round(expected));
  });

  it('offers full, short, extra sets and extra exercise with honest minutes', () => {
    const d = ready();
    const choices = startChoices(d, NOW);
    expect(choices.map((c) => c.mode)).toEqual(['full', 'short', 'extra-sets', 'extra-exercise']);
    const [full, short, sets, extra] = choices;
    expect(short.minutes).toBeLessThan(full.minutes);
    expect(sets.minutes).toBeGreaterThan(full.minutes);
    expect(extra.minutes).toBeGreaterThan(full.minutes);
  });

  it('short keeps every main lift and drops extras from the end', () => {
    const full = startSession(ready(), NOW).activeSession!;
    const short = applyStartMode(startSession(ready(), NOW), 'short').activeSession!;
    const mains = (s: typeof full) => s.exercises.filter((e) => e.role === 'anchor').map((e) => e.exerciseId);
    expect(mains(short)).toEqual(mains(full));
    expect(short.exercises.length).toBeLessThan(full.exercises.length);
    expect(full.exercises.map((e) => e.exerciseId).slice(0, short.exercises.length)).toEqual(short.exercises.map((e) => e.exerciseId));
  });

  it('extra sets add one set to main lifts and focus-muscle exercises only', () => {
    const full = startSession(ready(), NOW).activeSession!;
    const more = applyStartMode(startSession(ready(), NOW), 'extra-sets').activeSession!;
    full.exercises.forEach((e, i) => {
      const grew = more.exercises[i].sets.length - e.sets.length;
      const shouldGrow = e.role === 'anchor' || e.exerciseId.includes('lateral-raise');
      expect(grew, e.exerciseId).toBe(shouldGrow ? 1 : 0);
    });
    expect(more.exercises.every((e) => e.plan!.sets === e.sets.length)).toBe(true);
  });

  it('extra exercise adds one focus move that is not already in the session', () => {
    const full = startSession(ready(), NOW).activeSession!;
    const more = applyStartMode(startSession(ready(), NOW), 'extra-exercise').activeSession!;
    expect(more.exercises).toHaveLength(full.exercises.length + 1);
    const added = more.exercises.at(-1)!.exerciseId;
    expect(full.exercises.map((e) => e.exerciseId)).not.toContain(added);
    expect(['cable-lateral-raise', 'db-lateral-raise']).toContain(added);
  });

  it('full changes nothing, and nothing happens without an active session', () => {
    const d = startSession(ready(), NOW);
    expect(applyStartMode(d, 'full')).toBe(d);
    const idle = ready();
    expect(applyStartMode(idle, 'short')).toBe(idle);
  });
});
