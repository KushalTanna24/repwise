import { allExercises, getExercise } from '../../catalogue';
import type { AppData } from '../../types';
import { MAX_EXERCISES, isEligible } from '../planner';
import type { CustomSplit, Slot } from '../types';
import { weekSummary } from '../week';
import { newCustomSplit, newSlotId, splitBlurb } from './custom';
import type { ProSplit } from './pros';

export interface Adoption {
  split: CustomSplit;
  /** What changed from the original, in the user's words. Empty when nothing did. */
  changes: string[];
}

const nameOf = (data: AppData, id: string) => getExercise(id, data.customExercises)?.name ?? id;

/**
 * Copies a pro split into a custom split the user owns. Exercises the user
 * has no equipment for fall back to the next candidate, or to any eligible
 * move with the same pattern. With `fit`, extras past the session-length limit
 * are dropped from the end of each day, mains kept.
 */
export function adoptProSplit(data: AppData, pro: ProSplit, now: string, opts: { fit: boolean }): Adoption {
  const changes: string[] = [];
  const limit = MAX_EXERCISES[data.profile.sessionMinutes];
  const ok = (id: string) => isEligible(getExercise(id, data.customExercises), data);

  const sessions = pro.sessions.map((day) => {
    const used = new Set<string>();
    const slots: Slot[] = [];
    for (const slot of day.slots) {
      let candidates = slot.candidates.filter((id) => ok(id) && !used.has(id));
      if (!candidates.length) {
        const stand = allExercises(data).find((e) => e.pattern === slot.pattern && !e.calisthenics && isEligible(e, data) && !used.has(e.id));
        if (!stand) {
          changes.push(`${day.title}: dropped ${nameOf(data, slot.candidates[0])}, nothing in your equipment trains it`);
          continue;
        }
        candidates = [stand.id];
      }
      if (candidates[0] !== slot.candidates[0]) changes.push(`${day.title}: ${nameOf(data, candidates[0])} instead of ${nameOf(data, slot.candidates[0])}`);
      used.add(candidates[0]);
      slots.push({ id: newSlotId(), pattern: slot.pattern, role: slot.role, candidates });
    }

    if (opts.fit && slots.length > limit) {
      const dropped: string[] = [];
      while (slots.length > limit) {
        const last = slots.map((s) => s.role).lastIndexOf('accessory');
        if (last < 0) break;
        dropped.unshift(nameOf(data, slots[last].candidates[0]));
        slots.splice(last, 1);
      }
      if (dropped.length) changes.push(`${day.title}: left out ${dropped.join(', ')} to fit ${data.profile.sessionMinutes} min`);
    }
    return { title: day.title, ...(day.short ? { short: day.short } : {}), slots };
  });

  const base = newCustomSplit(data, null, now).split;
  const split: CustomSplit = { ...base, name: pro.name, copiedFrom: pro.id, sessions: sessions.filter((s) => s.slots.length > 0) };
  split.blurb = splitBlurb(split);

  const days = data.profile.daysPerWeek;
  if (days !== pro.daysPerWeek) {
    changes.push(`${pro.person.split(' ')[0]} ran it ${pro.daysPerWeek} days a week; you train ${days}. ${weekSummary(split.sessions.length, days)}`);
  }
  return { split, changes };
}

/** The user's live copy of a pro split, if they already have one. */
export function adoptedCopy(data: AppData, pro: Pick<ProSplit, 'id'>): CustomSplit | undefined {
  return data.customSplits.find((s) => s.copiedFrom === pro.id && !s.deletedAt);
}
