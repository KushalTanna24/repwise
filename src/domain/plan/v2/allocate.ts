import { GROUPS, type DayLayout, type Group } from './groups';
import { SESSION_CAP, type Targets } from './targets';

export interface DayPlan {
  title: string;
  cardio: boolean;
  /** Direct sets each group should get on this cycle day. */
  sets: Partial<Record<Group, number>>;
}

export interface Allocation {
  days: DayPlan[];
  /** Groups whose days cannot hold 90% of their target under the session cap. */
  short: Group[];
}

/**
 * Splits each weekly target over the cycle days that list the group. Repwise rotates the cycle,
 * so the per-cycle need is the weekly target scaled by cycle length over training days.
 */
export function allocate(layout: DayLayout[], targets: Targets, daysPerWeek: number): Allocation {
  const days: DayPlan[] = layout.map((d) => ({ title: d.title, cardio: !!d.cardio, sets: {} }));
  const short: Group[] = [];
  for (const g of GROUPS) {
    const target = targets.sets[g];
    if (target <= 0) continue;
    const idx = layout.flatMap((d, i) => (d.groups.includes(g) ? [i] : []));
    if (!idx.length) continue;
    const need = Math.round((target * layout.length) / Math.max(1, daysPerWeek));
    const base = Math.floor(need / idx.length);
    let extra = need - base * idx.length;
    let placed = 0;
    for (const i of idx) {
      const n = Math.min(SESSION_CAP, base + (extra > 0 ? 1 : 0));
      if (extra > 0) extra -= 1;
      if (n > 0) days[i].sets[g] = n;
      placed += n;
    }
    if (placed < 0.9 * need) short.push(g);
  }
  return { days, short };
}
