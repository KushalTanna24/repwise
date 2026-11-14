import type { Profile } from '../../types';
import { leannessTarget, type BodyFatEstimate } from '../body';
import type { PlanResultV2 } from './generate';
import { GROUPS, GROUP_LABEL, type Group } from './groups';
import { LOW_FREQ, STYLE_NAME } from './styles';

export type { BodyFatEstimate };

const MAX_LINES = 7;
const NO_HISTORY = 'No training history yet. The plan adapts after a few weeks of logged workouts.';

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const lower = (g: Group) => GROUP_LABEL[g].toLowerCase();
const num = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1));
const times = (x: number) => `${num(x)} ${x === 1 ? 'time' : 'times'}`;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Up to seven plain sentences on why the plan looks the way it does. `deficitKcal` is the daily cut, when there is one. */
export function explainV2(r: PlanResultV2, p: Profile, body: BodyFatEstimate | null, deficitKcal?: number): string[] {
  const sets = (g: Group) => Math.round(r.achieved[g]);
  const trained = GROUPS.filter((g) => r.targets.sets[g] > 0 && !r.limited.includes(g));
  const focus = GROUPS.filter((g) => r.targets.focus.has(g) && !r.limited.includes(g));
  const typical = Math.round(median(trained.map((g) => r.frequency[g])) * 2) / 2;
  const lines: string[] = [`${STYLE_NAME[r.style]}. Each muscle trained about ${times(typical)} a week.`];

  if (r.fallback) {
    const why = r.fallback.missing.length ? `leave out ${list(r.fallback.missing.map(lower))}` : 'have a day with nothing to train';
    lines.push(`Your custom pairs ${why}, so Repwise picked ${STYLE_NAME[r.style]}. Edit them in the split step.`);
  }

  const rare = focus.filter((g) => r.frequency[g] < LOW_FREQ);
  if (rare.length) {
    const f = Math.round(r.frequency[rare[0]] * 2) / 2;
    lines.push(
      `${list(rare.map((g, i) => (i === 0 ? GROUP_LABEL[g] : lower(g))))} trained about ${times(f)} a week. Fine for holding, slower for growing. Train 5 or more days or pick a style with more frequency.`,
    );
  }

  if (p.strengthBias && p.objective !== 'strength') lines.push('Main lifts go heavy (4–6 reps) for strength; everything else builds size.');
  for (const g of focus.slice(0, 3)) lines.push(`${GROUP_LABEL[g]}: ${sets(g)} sets a week across ${r.daysHit[g]} days (focus).`);
  for (const reason of r.targets.reasons) lines.push(reason.text);
  if (r.short.length) lines.push(`Short on time: ${list(r.short.map(lower))} get under their target. Add a day or longer sessions.`);
  if (r.limited.length) lines.push(`Limited equipment: nothing here trains ${list(r.limited.map(lower))} directly. Add dumbbells or cable in Profile.`);

  if (p.planGoal === 'look' && body && p.sex) {
    const [a, b]: Group[] = p.sex === 'male' ? ['side-delts', 'lats'] : ['glutes', 'side-delts'];
    const aim = p.sex === 'male' ? '10–15%' : '18–25%';
    const lead = p.sex === 'male' ? 'V-taper' : 'Shoulders, waist and glutes';
    const cut =
      p.bodyGoal === 'lose' && deficitKcal && deficitKcal > 0
        ? ` Waist stays tight through a ${Math.round(deficitKcal)} kcal deficit, about ${((deficitKcal * 7) / 7700).toFixed(1)} kg a week.`
        : '';
    const how = body.method === 'navy' ? 'tape' : 'rough';
    if (body.pct <= leannessTarget(p.sex).floor) {
      lines.push(`Body fat ~${Math.round(body.pct)}% (${how}) is at the healthy floor for ${p.sex === 'male' ? 'men' : 'women'}. Maintaining is the healthy choice, so calories stay at maintenance.`);
    } else {
      lines.push(`${lead}: ${lower(a)} ${sets(a)} sets and ${lower(b)} ${sets(b)} sets lead the week.${cut} Body fat ~${Math.round(body.pct)}% (${how}), aim ${aim}.`);
    }
  }

  const tail = r.history ? [] : [NO_HISTORY];
  return [...lines.slice(0, MAX_LINES - tail.length), ...tail];
}
