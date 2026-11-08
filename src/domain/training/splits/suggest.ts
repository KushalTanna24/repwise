import { allExercises } from '../../catalogue';
import type { AppData, Pattern, Profile } from '../../types';
import { BEGINNER_ORDER, MAX_EXERCISES, isEligible } from '../planner';
import type { Slot } from '../types';
import { newSlotId } from './custom';

export type DayFocus = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'arms-shoulders';

export const FOCUS_LABEL: Record<DayFocus, string> = {
  full: 'Full body',
  upper: 'Upper',
  lower: 'Lower',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  'arms-shoulders': 'Arms & shoulders',
};

export const FOCUS_PATTERNS: Record<DayFocus, Pattern[]> = {
  full: ['knee', 'hpush', 'hpull', 'hip', 'shoulders', 'core'],
  upper: ['hpush', 'vpull', 'hpull', 'vpush', 'shoulders', 'arms', 'arms'],
  lower: ['knee', 'hip', 'knee', 'hip', 'calves', 'core'],
  push: ['hpush', 'vpush', 'hpush', 'shoulders', 'arms', 'hpush'],
  pull: ['vpull', 'hpull', 'shoulders', 'arms', 'arms', 'vpull'],
  legs: ['knee', 'hip', 'knee', 'hip', 'calves', 'core'],
  'arms-shoulders': ['vpush', 'shoulders', 'arms', 'arms', 'shoulders', 'arms'],
};

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

  let added = true;
  while (picks.length < limit && added) {
    added = false;
    for (const pattern of FOCUS_PATTERNS[focus]) {
      if (picks.length >= limit) break;
      const [main, ...rest] = eligibleFor(pattern);
      if (!main) continue;
      used.add(main);
      const candidates = [main];
      if (picks.length >= anchors) {
        for (const alt of rest.slice(0, 2)) {
          used.add(alt);
          candidates.push(alt);
        }
      }
      picks.push({ pattern, candidates });
      added = true;
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
