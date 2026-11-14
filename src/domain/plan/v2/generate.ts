import { newCustomSplit, newSlotId, splitBlurb, type CustomSplit } from '../../training';
import type { AppData } from '../../types';
import { allocate } from './allocate';
import { GROUPS, type DayLayout, type Group, type StyleId } from './groups';
import { readHistory } from './history';
import { planDistance, scorePlan } from './score';
import { buildCandidate, buildPool, limitedGroups, makeCtx, type Candidate } from './select';
import { STYLE_NAME, frequency, pickStyle, styleLayout, validateCustomPairs } from './styles';
import { weeklyTargets, type Targets } from './targets';

export const CANDIDATES = 20;
export const MIN_DISTANCE = 0.4;
const BATCHES = 5;

export interface PlanRequest {
  style: StyleId | 'auto';
  customPairs?: DayLayout[];
  /** Base seed for this builder run. */
  seed: number;
  /** Exercise picks of plans already shown in this run; Regenerate avoids anything too close. */
  shown: string[][][];
}

export interface PlanResultV2 {
  split: CustomSplit;
  style: StyleId;
  layout: DayLayout[];
  targets: Targets;
  achieved: Record<Group, number>;
  daysHit: Record<Group, number>;
  frequency: Record<Group, number>;
  /** Under target because the days that train it ran out of room. */
  short: Group[];
  /** No eligible exercise trains the group directly. */
  limited: Group[];
  picks: string[][];
  /** No plan different enough from the ones shown was left; this is the best one again. */
  exhausted: boolean;
  score: number;
  /** Whether the history was long enough to adjust targets. */
  history: boolean;
  /** Custom pairs were asked for but could not be used as saved; another style was picked. */
  fallback: { missing: Group[]; emptyDays: number[] } | null;
}

/**
 * Builds 20 seeded candidates and keeps the best by whole-plan score. Regenerate passes the
 * plans already shown and gets the best candidate at least 40% different from all of them.
 */
export function generatePlanV2(data: AppData, req: PlanRequest, now: string): PlanResultV2 {
  const p = data.profile;
  const history = readHistory(data, now);
  const targets = weeklyTargets(p, history);

  let style: StyleId;
  let layout: DayLayout[];
  let fallback: PlanResultV2['fallback'] = null;
  const pairs = req.customPairs ?? p.customPairs;
  const cardioOk = buildPool(data).some((it) => it.ex.pattern === 'cardio');
  const check = req.style === 'custom' && pairs ? validateCustomPairs(pairs, targets, p.daysPerWeek, cardioOk) : null;
  if (check?.ok && pairs) {
    style = 'custom';
    layout = pairs.map((d) => ({ ...d, groups: [...d.groups] }));
  } else {
    style = req.style === 'auto' || req.style === 'custom' ? pickStyle(p.daysPerWeek, targets) : req.style;
    layout = styleLayout(style as Exclude<StyleId, 'custom'>, p.daysPerWeek);
    if (req.style === 'custom') fallback = { missing: check?.missing ?? [], emptyDays: check?.emptyDays ?? [] };
  }

  const allocation = allocate(layout, targets, p.daysPerWeek);
  const ctx = makeCtx(data, targets, layout, allocation, history, now);
  const limited = limitedGroups(data).filter((g) => targets.sets[g] > 0);

  let best: { c: Candidate; score: number } | null = null;
  let chosen: { c: Candidate; score: number } | null = null;
  for (let k = 0; k < BATCHES && !chosen; k++) {
    // Regenerate widens the jitter batch by batch, so near-equal swaps give way to real alternatives.
    const jitter = req.shown.length ? 0.3 + 0.6 * (k + 1) : 0.3;
    const batch = Array.from({ length: CANDIDATES }, (_, i) => {
      const c = buildCandidate(ctx, req.seed + k * CANDIDATES + i, jitter);
      return { c, score: scorePlan(c, ctx) };
    }).sort((a, b) => b.score - a.score);
    if (!best || batch[0].score > best.score) best = batch[0];
    chosen = batch.find((x) => req.shown.every((s) => planDistance(s, x.c.picks) >= MIN_DISTANCE)) ?? null;
  }
  const exhausted = !chosen;
  const { c, score } = chosen ?? best!;

  const full = (g: Group) => layout.every((d, i) => !d.groups.includes(g) || c.sessions[i].slots.filter((x) => x.pattern !== 'cardio').length >= targets.exerciseLimit);
  const short = GROUPS.filter(
    (g) => targets.sets[g] > 0 && !limited.includes(g) && (allocation.short.includes(g) || (c.achieved[g] < 0.9 * targets.sets[g] && full(g))),
  );

  // A day the equipment cannot fill at all is dropped, not allowed to sink the whole plan.
  const keep = c.sessions.flatMap((s, i) => (s.slots.length > 0 ? [i] : []));
  const kept = keep.length ? keep : c.sessions.map((_, i) => i);
  const finalLayout = kept.map((i) => layout[i]);

  // Candidates skip slot ids to stay fast; only the plan shown gets real ones.
  const sessions = kept.map((i) => ({ ...c.sessions[i], slots: c.sessions[i].slots.map((slot) => ({ ...slot, id: newSlotId() })) }));
  const split: CustomSplit = { ...newCustomSplit(data, null, now).split, name: `Your plan · ${STYLE_NAME[style]}`, sessions };
  split.blurb = splitBlurb(split);

  return {
    split,
    style,
    layout: finalLayout,
    targets,
    achieved: c.achieved,
    daysHit: c.daysHit,
    frequency: frequency(finalLayout, p.daysPerWeek),
    short,
    limited,
    picks: kept.map((i) => c.picks[i]),
    exhausted,
    score,
    history: history.qualifies,
    fallback,
  };
}
