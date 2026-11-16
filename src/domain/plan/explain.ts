import type { Profile } from '../types';
import type { PlanResult } from './generate';
import { GROUP_LABEL, GROUPS, type Group } from './volume';

const ABS_LINE = 'Abs show when body fat is low. Your calorie target does more for them than an extra abs day.';
const BEGINNER_LINE = 'Beginners grow on less. Volume rises as you progress.';

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const lower = (g: Group) => GROUP_LABEL[g].toLowerCase();

/** Up to six plain sentences on why the plan looks the way it does, focus first. */
export function explain(r: PlanResult, p: Profile, bmiValue: number | null): string[] {
  const sets = (g: Group) => Math.round(r.achieved[g]);
  const focus = GROUPS.filter((g) => r.targets.focus.has(g) && !r.limited.includes(g));
  const lines: string[] = [];

  if (focus.length <= 3) {
    for (const g of focus) lines.push(`${GROUP_LABEL[g]}: ${sets(g)} sets a week across ${r.daysHit[g]} days (focus).`);
  } else {
    lines.push(`Focus muscles: ${list(focus.map((g) => `${GROUP_LABEL[g]} ${sets(g)}`))} sets a week.`);
  }

  const others = GROUPS.filter((g) => !r.targets.focus.has(g) && !r.limited.includes(g) && !r.short.includes(g)).map(sets);
  if (others.length) {
    const min = Math.min(...others);
    const max = Math.max(...others);
    const range = min === max ? `${min}` : `${min} to ${max}`;
    lines.push(`Other muscles: ${range} sets a week, ${min >= 10 ? 'enough to keep growing' : 'enough to hold on and keep building slowly'}.`);
  }

  if (r.short.length) lines.push(`Short on time: ${list(r.short.map(lower))} get under 6 sets a week. Add a day or longer sessions.`);
  if (r.limited.length) lines.push(`Limited equipment: nothing here trains ${list(r.limited.map(lower))} directly.`);
  if (r.targets.focus.has('abs') && bmiValue != null && bmiValue >= 25) lines.push(ABS_LINE);
  if (p.experience === 'beginner') lines.push(BEGINNER_LINE);

  return lines.slice(0, 6);
}
