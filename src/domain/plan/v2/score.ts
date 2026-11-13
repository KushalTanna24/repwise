import { metaFor } from './exerciseMeta';
import { GROUPS } from './groups';
import { quality, type Candidate, type Ctx } from './select';

export const SCORE_WEIGHTS = { coverage: 4, frequency: 1, variety: 1, dayFit: 2, quality: 1, history: 1 };

/** Whole-plan score; higher is better. Exercise order is enforced when slots are sorted, so it is not scored. */
export function scorePlan(c: Candidate, ctx: Ctx): number {
  const { targets, layout, history, data } = ctx;
  const limit = targets.exerciseLimit;
  const byId = new Map(ctx.pool.map((it) => [it.ex.id, it]));
  const metaOf = (id: string) => byId.get(id)?.meta ?? metaFor(data.customExercises.find((e) => e.id === id) ?? { id, name: id, muscle: '', pattern: 'core', equipment: 'bodyweight', kind: 'weighted' });

  let coverage = 0;
  for (const g of GROUPS) {
    const t = targets.sets[g];
    if (t <= 0) continue;
    coverage -= ((targets.focus.has(g) ? 2 : 1) * Math.abs(c.achieved[g] - t)) / Math.max(t, 1);
  }

  let frequency = 0;
  for (const g of targets.focus) if (layout.filter((d) => d.groups.includes(g)).length >= 2 && c.daysHit[g] >= 2) frequency += 1;

  const count = new Map<string, number>();
  const anchors = new Set<string>();
  for (const s of c.sessions)
    for (const slot of s.slots) {
      count.set(slot.candidates[0], (count.get(slot.candidates[0]) ?? 0) + 1);
      if (slot.role === 'anchor') anchors.add(slot.candidates[0]);
    }
  const variety = -[...count].filter(([id, n]) => n > 2 && !anchors.has(id)).length;

  const minimum = Math.min(limit, Math.max(3, limit - 2));
  let dayFit = 0;
  c.sessions.forEach((s, i) => {
    if (layout[i]?.cardio) return;
    const n = s.slots.filter((x) => x.pattern !== 'cardio').length;
    dayFit -= Math.max(0, n - limit) + Math.max(0, minimum - n);
  });

  const lifts = c.sessions.flatMap((s) => s.slots.filter((x) => x.pattern !== 'cardio').map((x) => x.candidates[0]));
  const q = lifts.length ? lifts.reduce((a, id) => a + quality(metaOf(id)), 0) / lifts.length / 3.5 : 0;
  const h = lifts.length && history ? (lifts.filter((id) => history.liked.has(id)).length - lifts.filter((id) => history.avoided.has(id)).length) / lifts.length : 0;

  const W = SCORE_WEIGHTS;
  return W.coverage * coverage + W.frequency * frequency + W.variety * variety + W.dayFit * dayFit + W.quality * q + W.history * h;
}

/** Jaccard distance on the set of exercises used anywhere in the plan. */
export function planDistance(a: string[][], b: string[][]): number {
  const A = new Set(a.flat());
  const B = new Set(b.flat());
  const union = new Set([...A, ...B]);
  if (!union.size) return 0;
  let both = 0;
  for (const id of A) if (B.has(id)) both += 1;
  return 1 - both / union.size;
}
