import { BUILTIN_EXERCISES } from '../../catalogue';
import { MAX_EXERCISES, prescription } from '../../training';
import type { Profile } from '../../types';
import { GROUPS, GROUP_LABEL, MAJOR, focusGroups, type Group } from './groups';
import type { History } from './history';

/** Below this a group is maintained, not grown (Bickel 2011). */
export const FLOOR = 6;
/** Direct sets one group can usefully take in a session (Pelland 2024). */
export const SESSION_CAP = 10;

const BASE_MAJOR: Record<Profile['experience'], number> = { beginner: 9, intermediate: 12, advanced: 15 };
const BASE_SMALL: Record<Profile['experience'], number> = { beginner: 6, intermediate: 8, advanced: 10 };

export interface TargetReason {
  group: Group;
  delta: number;
  text: string;
}

export interface Targets {
  sets: Record<Group, number>;
  focus: Set<Group>;
  budget: number;
  exerciseLimit: number;
  reasons: TargetReason[];
}

const capFor = (p: Profile) => (p.experience === 'beginner' ? 14 : 20);

/** A group's target when it is not a focus. Front delts get no direct work; neck and forearms are opt-in. */
function baseFor(p: Profile, g: Group, focus: Set<Group>): number {
  if (g === 'front-delts') return 0;
  if ((g === 'neck' || g === 'forearms') && !focus.has(g)) return 0;
  return MAJOR.has(g) ? BASE_MAJOR[p.experience] : BASE_SMALL[p.experience];
}

/** Weekly hard sets per group from the evidence alone (Schoenfeld 2017, Pelland 2024, Baz-Valle 2022). */
export function evidenceTargets(p: Profile): Record<Group, number> {
  const focus = focusGroups(p.focus);
  const factor = p.bodyGoal === 'lose' ? 1.15 : 1.4;
  const sets = Object.fromEntries(
    GROUPS.map((g) => {
      const base = baseFor(p, g, focus);
      return [g, focus.has(g) ? Math.min(capFor(p), Math.round(base * factor)) : base];
    }),
  ) as Record<Group, number>;
  if (p.planGoal === 'look') {
    // Side and rear delts shape the shoulders and help posture, focus or not.
    sets['side-delts'] = Math.max(sets['side-delts'], 8);
    sets['rear-delts'] = Math.max(sets['rear-delts'], 8);
    if (p.sex === 'male') {
      sets.neck = Math.max(sets.neck, 5);
      sets.forearms = Math.max(sets.forearms, 4);
    }
  }
  return sets;
}

const liftName = (id: string) => (BUILTIN_EXERCISES.find((e) => e.id === id)?.name ?? id).toLowerCase();

/**
 * Evidence targets moved toward what the person really does (never more than +20% or +4 sets
 * above their baseline), nudged by how each group's lifts are trending, then fitted to their time.
 */
export function weeklyTargets(p: Profile, h: History | null): Targets {
  const focus = focusGroups(p.focus);
  const ev = evidenceTargets(p);
  const cap = capFor(p);
  const sets = { ...ev };
  const reasons: TargetReason[] = [];

  if (h?.qualifies) {
    for (const g of GROUPS) {
      if (ev[g] <= 0) continue;
      const b = h.baseline[g];
      let t = b >= ev[g] ? Math.min(b, cap) : Math.min(ev[g], Math.max(Math.min(ev[g], FLOOR), b + Math.min(0.2 * b, 4)));
      t = Math.round(t);
      const tr = h.trend[g];
      if (tr && (tr.change < -0.03 || h.adherence < 0.6)) {
        if (t > ev[g]) {
          t -= 2;
          reasons.push({ group: g, delta: -2, text: `${GROUP_LABEL[g]} ${t} sets (−2): ${liftName(tr.lift)} is slipping, so recovery comes first.` });
        }
      } else if (tr && tr.flatWeeks >= 3 && h.adherence >= 0.75 && t < cap) {
        t = Math.min(cap, t + 2);
        reasons.push({ group: g, delta: 2, text: `${GROUP_LABEL[g]} ${t} sets (+2): ${liftName(tr.lift)} flat ${tr.flatWeeks} weeks.` });
      }
      sets[g] = t;
    }
  }

  const unfinished = h?.finishRate != null && h.finishRate < 0.8;
  const exerciseLimit = MAX_EXERCISES[p.sessionMinutes] - (unfinished ? 1 : 0);
  if (unfinished) reasons.push({ group: 'abs', delta: 0, text: `Days have 1 fewer exercise: you usually finish about ${Math.round(h!.finishRate! * 100)}% of them.` });
  const budget = p.daysPerWeek * exerciseLimit * prescription(p, 'accessory', undefined).sets;

  const total = () => GROUPS.reduce((a, g) => a + sets[g], 0);
  const trim = (pool: Group[], min: (g: Group) => number) => {
    while (total() > budget) {
      let pick: Group | null = null;
      for (const g of pool) if (sets[g] > min(g) && (!pick || sets[g] >= sets[pick])) pick = g;
      if (!pick) return;
      sets[pick] -= 1;
    }
  };
  const floors = { ...sets };
  trim(GROUPS.filter((g) => !focus.has(g)), (g) => Math.min(FLOOR, floors[g]));
  trim(GROUPS.filter((g) => focus.has(g)), (g) => Math.min(baseFor(p, g, focus), floors[g]));

  return { sets, focus, budget, exerciseLimit, reasons };
}
