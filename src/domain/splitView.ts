import { getExercise } from './catalogue';
import { metaFor, primaryGroups } from './plan/v2/exerciseMeta';
import { GROUPS, GROUP_LABEL, type Group } from './plan/v2/groups';
import { isEligible, prescription, type SplitDef } from './training';
import type { AppData, EquipmentKind } from './types';

export interface ViewExercise {
  name: string;
  main: boolean;
  /** "3 × 8–12", "3 × 30–60s" or "15 min". */
  rx: string;
  equipment: EquipmentKind | null;
  /** Other exercises this slot can swap to. */
  alternates: number;
}

export interface ViewDay {
  title: string;
  /** The muscles the day trains directly, as a sentence fragment. */
  muscles: string;
  exercises: ViewExercise[];
}

/** What each day of a split asks you to do, with the exercises your equipment allows. */
export function describeSplit(data: AppData, split: SplitDef): ViewDay[] {
  const p = data.profile;
  return split.sessions.map((s) => {
    const trained = new Set<Group>();
    const exercises = s.slots.map((slot): ViewExercise => {
      const options = slot.candidates.map((id) => getExercise(id, data.customExercises)).filter((ex) => isEligible(ex, data));
      const ex = options[0];
      if (!ex) return { name: 'No option for your equipment', main: slot.role === 'anchor', rx: '', equipment: null, alternates: 0 };
      for (const g of primaryGroups(metaFor(ex))) trained.add(g);
      const rx = prescription(p, slot.role, ex, p.sessionMinutes);
      const text = ex.pattern === 'cardio' ? `${Math.round(rx.repMin / 60)} min` : ex.kind === 'timed' ? `${rx.sets} × ${rx.repMin}–${rx.repMax}s` : `${rx.sets} × ${rx.repMin}–${rx.repMax}`;
      return { name: ex.name, main: slot.role === 'anchor', rx: text, equipment: ex.equipment, alternates: options.length - 1 };
    });
    const names = GROUPS.filter((g) => trained.has(g)).map((g) => GROUP_LABEL[g].toLowerCase());
    const muscles = names.length ? names[0].charAt(0).toUpperCase() + names.join(', ').slice(1) : 'Nothing your equipment allows yet';
    return { title: s.title, muscles, exercises };
  });
}
