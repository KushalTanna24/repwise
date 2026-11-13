import { allExercises } from '../../catalogue';
import { isEligible, prescription, type Slot } from '../../training';
import type { AppData, Exercise } from '../../types';
import type { Allocation } from './allocate';
import { metaFor, primaryGroups, type ExerciseMeta } from './exerciseMeta';
import { GROUPS, MAJOR, type DayLayout, type Group } from './groups';
import type { History } from './history';
import { rng } from './rng';
import { FLOOR, type Targets } from './targets';

export interface PoolItem {
  ex: Exercise;
  meta: ExerciseMeta;
  primary: Group[];
  order: number;
  /** Precomputed for the hot loop. */
  muscles: [Group, number][];
  clash: string;
  quality: number;
}

export interface Ctx {
  data: AppData;
  targets: Targets;
  layout: DayLayout[];
  allocation: Allocation;
  history: History | null;
  now: string;
  /** Eligible exercises with metadata, built once per generate call. */
  pool: PoolItem[];
  /** Pool items by primary group. */
  byGroup: Map<Group, PoolItem[]>;
  /** Same-pattern, same-primary alternates for each exercise, best first. */
  alts: Map<string, PoolItem[]>;
}


// Two compounds clash on a day when they share a pattern and main muscles (two flat presses, two squats).

export interface Candidate {
  sessions: { title: string; slots: Slot[] }[];
  /** Exercise id of each slot's main pick, per day. */
  picks: string[][];
  /** Weekly sets per group, primary 1 and secondary 0.5. */
  achieved: Record<Group, number>;
  /** Cycle days that touch the group at all. */
  daysHit: Record<Group, number>;
}

const TIER: Record<ExerciseMeta['tier'], number> = { S: 3, A: 2, B: 1 };
export const quality = (m: ExerciseMeta) => TIER[m.tier] + (m.stretch && !m.compound ? 0.5 : 0);

export function buildPool(data: AppData): PoolItem[] {
  const beginner = data.profile.experience === 'beginner';
  return allExercises(data)
    .filter((e) => isEligible(e, data) && !e.calisthenics)
    .map((ex, order) => {
      const meta = metaFor(ex);
      const primary = primaryGroups(meta);
      return { ex, meta, primary, order, muscles: Object.entries(meta.muscles) as [Group, number][], clash: `${ex.pattern}:${[...primary].sort().join(',')}`, quality: quality(meta) };
    })
    .filter((it) => !(beginner && it.meta.skill === 'high'));
}

export function makeCtx(data: AppData, targets: Targets, layout: DayLayout[], allocation: Allocation, history: History | null, now: string): Ctx {
  const pool = buildPool(data);
  const byGroup = new Map<Group, PoolItem[]>(GROUPS.map((g) => [g, pool.filter((it) => it.ex.pattern !== 'cardio' && it.primary.includes(g))]));
  const same = (a: Group[], b: Group[]) => a.length === b.length && a.every((x) => b.includes(x));
  const alts = new Map(
    pool.map((it) => [
      it.ex.id,
      pool.filter((a) => a.ex.id !== it.ex.id && a.ex.pattern === it.ex.pattern && same(a.primary, it.primary)).sort((a, b) => quality(b.meta) - quality(a.meta) || a.order - b.order),
    ]),
  );
  return { data, targets, layout, allocation, history, now, pool, byGroup, alts };
}

export function limitedGroups(data: AppData): Group[] {
  const pool = buildPool(data);
  return GROUPS.filter((g) => !pool.some((it) => it.primary.includes(g)));
}

interface Placed {
  slot: Slot;
  item: PoolItem;
  group: Group;
}

interface DayState {
  layout: DayLayout;
  placed: Placed[];
  remaining: Partial<Record<Group, number>>;
  blocked: Set<Group>;
  /** Lifting slots placed (cardio excluded). */
  lifts: number;
  /** Slots per primary group. */
  direct: Map<Group, number>;
  used: Set<string>;
  clashes: Set<string>;
  heavy: number;
  /** Groups that already have a slot, and those with an anchor. */
  opened: Set<Group>;
  anchored: Set<Group>;
}

/**
 * One candidate plan. A greedy pass over all days gives one exercise at a time to the group
 * furthest below its weekly target (groups under their floor first, focus before the rest),
 * on the day that has trained it least. The seed only reorders near-equal exercise choices.
 */
export function buildCandidate(ctx: Ctx, seed: number, jitter = 0.3): Candidate {
  const { data, targets, layout, allocation, history, pool } = ctx;
  const p = data.profile;
  const rand = rng(seed);
  const limit = targets.exerciseLimit;
  const scale = p.daysPerWeek / Math.max(1, layout.length);
  const look = p.planGoal === 'look';
  const achieved = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  const uses = new Map<string, number>();
  const must = (g: Group) => Math.min(targets.sets[g], look && (g === 'side-delts' || g === 'rear-delts') ? 8 : FLOOR);

  const days: DayState[] = layout.map((l, i) => ({
    layout: l,
    placed: [],
    remaining: { ...allocation.days[i]?.sets },
    blocked: new Set(),
    lifts: 0,
    direct: new Map(),
    used: new Set(),
    clashes: new Set(),
    heavy: 0,
    opened: new Set(),
    anchored: new Set(),
  }));
  const lifting = (d: DayState) => d.lifts;
  const direct = (d: DayState, g: Group) => d.direct.get(g) ?? 0;
  const setsFor = { anchor: prescription(p, 'anchor', undefined).sets, accessory: prescription(p, 'accessory', undefined).sets };

  function rank(it: PoolItem): number {
    let s = it.quality;
    if (history?.liked.has(it.ex.id)) s += 0.75;
    if (history?.avoided.has(it.ex.id)) s -= 1.5;
    return s + rand() * jitter;
  }

  function pick(d: DayState, g: Group): PoolItem | undefined {
    const opening = MAJOR.has(g) && !d.opened.has(g);
    const ok = (it: PoolItem) =>
      !d.used.has(it.ex.id) &&
      !(it.meta.compound && d.clashes.has(it.clash)) &&
      !(it.meta.fatigue === 'high' && d.heavy >= 2) &&
      ((uses.get(it.ex.id) ?? 0) < 2 || (opening && it.meta.compound));
    let options = (ctx.byGroup.get(g) ?? []).filter(ok);
    if (opening && options.some((it) => it.meta.compound)) options = options.filter((it) => it.meta.compound);
    let best: PoolItem | undefined;
    let bestScore = -Infinity;
    for (const it of options) {
      const s = rank(it);
      if (s > bestScore || (s === bestScore && best && it.order < best.order)) {
        best = it;
        bestScore = s;
      }
    }
    return best;
  }

  function place(d: DayState, g: Group, it: PoolItem) {
    const role: Slot['role'] = MAJOR.has(g) && it.meta.compound && !d.anchored.has(g) ? 'anchor' : 'accessory';
    const sets = it.ex.kind === 'timed' ? prescription(p, role, it.ex, p.sessionMinutes).sets : setsFor[role];
    const alternates: string[] = [];
    for (const a of ctx.alts.get(it.ex.id) ?? []) {
      if (alternates.length === 2) break;
      if (!d.used.has(a.ex.id)) alternates.push(a.ex.id);
    }
    d.placed.push({ slot: { id: '', pattern: it.ex.pattern, role, candidates: [it.ex.id, ...alternates] }, item: it, group: g });
    d.used.add(it.ex.id);
    d.opened.add(g);
    if (role === 'anchor') d.anchored.add(g);
    if (it.meta.compound) d.clashes.add(it.clash);
    if (it.meta.fatigue === 'high') d.heavy += 1;
    uses.set(it.ex.id, (uses.get(it.ex.id) ?? 0) + 1);
    if (it.ex.pattern !== 'cardio') d.lifts += 1;
    for (const h of it.primary) d.direct.set(h, (d.direct.get(h) ?? 0) + 1);
    for (const [h, w] of it.muscles) achieved[h] += sets * w * scale;
    for (const h of it.primary) if (d.remaining[h] != null) d.remaining[h] = d.remaining[h]! - sets;
  }

  // Main pass: weekly targets, within each day's allocation.
  for (;;) {
    let best: { d: DayState; g: Group; score: number; direct: number; di: number } | null = null;
    days.forEach((d, di) => {
      if (lifting(d) >= limit) return;
      for (const g of d.layout.groups) {
        if (targets.sets[g] <= 0 || d.blocked.has(g) || (d.remaining[g] ?? 0) <= 0 || achieved[g] >= targets.sets[g]) continue;
        const focus = targets.focus.has(g);
        const urgent = achieved[g] < must(g) ? (focus ? 2 : 1) : 0;
        const score = urgent + (targets.sets[g] - achieved[g]) / targets.sets[g] + (focus ? 0.25 : 0);
        const dir = direct(d, g);
        if (!best || score > best.score || (score === best.score && (dir < best.direct || (dir === best.direct && di < best.di)))) best = { d, g, score, direct: dir, di };
      }
    });
    if (!best) break;
    const { d, g } = best as { d: DayState; g: Group };
    const it = pick(d, g);
    if (it) place(d, g, it);
    else d.blocked.add(g);
  }

  // A day the user set aside should not be a two-exercise session.
  const minimum = Math.min(limit, Math.max(3, limit - 2));
  for (const d of days) {
    const tried = new Set<Group>();
    while (lifting(d) < minimum) {
      const g = d.layout.groups
        .filter((h) => targets.sets[h] > 0 && !tried.has(h))
        .sort((a, b) => achieved[a] / targets.sets[a] - achieved[b] / targets.sets[b])[0];
      if (!g) break;
      const it = pick(d, g);
      if (it) place(d, g, it);
      else tried.add(g);
    }
  }

  // Cardio closes the day.
  for (const d of days) {
    if (!d.layout.cardio) continue;
    const options = pool.filter((it) => it.ex.pattern === 'cardio');
    let best: PoolItem | undefined;
    let bestScore = -Infinity;
    for (const it of options) {
      const s = rand();
      if (s > bestScore) {
        best = it;
        bestScore = s;
      }
    }
    if (best) place(d, 'abs', best);
  }

  const key = (x: Placed) => {
    if (x.item.ex.pattern === 'cardio') return 5;
    if (x.group === 'abs') return 4;
    if (x.slot.role === 'anchor') return 0;
    if (targets.focus.has(x.group)) return 1;
    return x.item.meta.compound ? 2 : 3;
  };
  const sessions = days.map((d) => ({
    title: d.layout.title,
    slots: d.placed
      .map((x, i) => ({ x, i }))
      .sort((a, b) => key(a.x) - key(b.x) || a.i - b.i)
      .map(({ x }) => x.slot),
  }));
  const daysHit = Object.fromEntries(GROUPS.map((g) => [g, days.filter((d) => d.placed.some((x) => (x.item.meta.muscles[g] ?? 0) > 0)).length])) as Record<Group, number>;
  return { sessions, picks: sessions.map((s) => s.slots.map((x) => x.candidates[0])), achieved, daysHit };
}
