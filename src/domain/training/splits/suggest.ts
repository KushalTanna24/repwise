import { allExercises } from '../../catalogue';
import type { AppData, FocusArea, Pattern, Profile } from '../../types';
import { BEGINNER_ORDER, MAX_EXERCISES, isEligible } from '../planner';
import type { Slot, SplitDef } from '../types';
import { newSlotId } from './custom';

export type DayFocus = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'arms-shoulders' | 'abs-focus';

export const FOCUS_LABEL: Record<DayFocus, string> = {
  full: 'Full body',
  upper: 'Upper',
  lower: 'Lower',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  'arms-shoulders': 'Arms & shoulders',
  'abs-focus': 'Abs + focus muscles',
};

/** Patterns that train each focus area; an abs day fills with these after its core work. */
export const AREA_PATTERNS: Record<FocusArea, Pattern[]> = {
  chest: ['hpush'],
  back: ['vpull', 'hpull'],
  shoulders: ['shoulders', 'vpush'],
  arms: ['arms', 'arms'],
  legs: ['knee', 'hip'],
  glutes: ['hip'],
  abs: ['core'],
  'upper-chest': ['hpush'],
  'side-delts': ['shoulders'],
  lats: ['vpull'],
  'traps-neck': ['neck'],
  forearms: ['arms'],
};

export const FOCUS_PATTERNS: Record<DayFocus, Pattern[]> = {
  full: ['knee', 'hpush', 'hpull', 'hip', 'shoulders', 'core'],
  upper: ['hpush', 'vpull', 'hpull', 'vpush', 'shoulders', 'arms', 'arms'],
  lower: ['knee', 'hip', 'knee', 'hip', 'calves', 'core'],
  push: ['hpush', 'vpush', 'hpush', 'shoulders', 'arms', 'hpush'],
  pull: ['vpull', 'hpull', 'shoulders', 'arms', 'arms', 'vpull'],
  legs: ['knee', 'hip', 'knee', 'hip', 'calves', 'core'],
  'arms-shoulders': ['vpush', 'shoulders', 'arms', 'arms', 'shoulders', 'arms'],
  // Without a focus set: core, then arms and shoulders. With one, the tail follows the focus.
  'abs-focus': ['core', 'core', 'shoulders', 'arms', 'arms', 'vpush'],
};

/** An abs day: 2 or 3 core slots (6 to 9 sets), then the user's focus areas, cycled. */
function absDayPatterns(profile: Profile, limit: number): { head: Pattern[]; cycle: Pattern[] } {
  const tail = (profile.focus ?? []).filter((f) => f !== 'abs').flatMap((f) => AREA_PATTERNS[f]);
  return {
    head: Array<Pattern>(limit >= 7 ? 3 : 2).fill('core'),
    cycle: tail.length ? tail : FOCUS_PATTERNS['abs-focus'].filter((p) => p !== 'core'),
  };
}

/** Abs recover fast; a lone abs day with no core anywhere else earns a short note in the editor. */
export function needsCoreNote(split: SplitDef, day: number): boolean {
  const opensWithCore = split.sessions[day]?.slots[0]?.pattern === 'core';
  return opensWithCore && !split.sessions.some((s, i) => i !== day && s.slots.some((x) => x.pattern === 'core'));
}

/** Slots for one day: eligible, unique exercises, filled to the session-length limit. */
export function suggestDay(data: AppData, focus: DayFocus, existing: string[] = []): Slot[] {
  const limit = MAX_EXERCISES[data.profile.sessionMinutes];
  const anchors = focus === 'full' || focus === 'lower' ? 3 : 2;
  const beginner = data.profile.experience === 'beginner';
  const used = new Set(existing);
  const picks: { pattern: Pattern; candidates: string[] }[] = [];

  const eligibleFor = (pattern: Pattern) => {
    let list = allExercises(data).filter((e) => e.pattern === pattern && isEligible(e, data) && !used.has(e.id));
    if (beginner) list = [...list].sort((a, b) => BEGINNER_ORDER[a.equipment] - BEGINNER_ORDER[b.equipment]);
    return list.map((e) => e.id);
  };

  const place = (pattern: Pattern) => {
    const [main, ...rest] = eligibleFor(pattern);
    if (!main) return false;
    used.add(main);
    const candidates = [main];
    if (picks.length >= anchors) {
      for (const alt of rest.slice(0, 2)) {
        used.add(alt);
        candidates.push(alt);
      }
    }
    picks.push({ pattern, candidates });
    return true;
  };

  const { head, cycle } = focus === 'abs-focus' ? absDayPatterns(data.profile, limit) : { head: [], cycle: FOCUS_PATTERNS[focus] };
  for (const pattern of head) if (picks.length < limit) place(pattern);

  let added = true;
  while (picks.length < limit && added) {
    added = false;
    for (const pattern of cycle) {
      if (picks.length >= limit) break;
      if (place(pattern)) added = true;
    }
  }

  return picks.map((p, i) => ({ id: newSlotId(), pattern: p.pattern, role: i < anchors ? 'anchor' : 'accessory', candidates: p.candidates }));
}

export function dayGuide(profile: Pick<Profile, 'sessionMinutes'>, count: number): { limit: number; over: boolean; text: string } {
  const limit = MAX_EXERCISES[profile.sessionMinutes];
  const over = count > limit;
  const m = profile.sessionMinutes;
  const text = over ? `${count} exercises · more than the ${limit} that usually fit ${m} min` : `${count} exercises · about right for ${m} min`;
  return { limit, over, text };
}
