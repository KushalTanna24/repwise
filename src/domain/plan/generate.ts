import { V2_ONLY_IDS, allExercises } from '../catalogue';
import { BEGINNER_ORDER, MAX_EXERCISES, isEligible, newCustomSplit, newSlotId, prescription, splitBlurb } from '../training';
import type { CustomSplit, Slot } from '../training';
import type { AppData, Exercise, Pattern } from '../types';
import { TEMPLATES, dayGroups, type DayKind, type TemplateId } from './template';
import { FLOOR, GROUPS, exerciseGroups, idealTargets, setsPerExercise, weeklyTargets, type Group, type Targets } from './volume';

export interface PlanResult {
  split: CustomSplit;
  template: TemplateId;
  targets: Targets;
  /** Weekly sets per group, primary 1 and secondary 0.5. */
  achieved: Record<Group, number>;
  /** Days that touch the group at all. */
  daysHit: Record<Group, number>;
  /** Below the floor because time ran out. */
  short: Group[];
  /** No eligible exercise trains the group directly. */
  limited: Group[];
}

const COMPOUND_PATTERNS = new Set<Pattern>(['knee', 'hip', 'hpush', 'vpush', 'hpull', 'vpull']);
/** Single-joint moves that share a compound pattern in the catalogue. */
const ISOLATION_IDS = new Set(['leg-extension', 'leg-curl', 'cable-fly', 'straight-arm-pulldown']);
export const isCompound = (ex: Exercise) => COMPOUND_PATTERNS.has(ex.pattern) && !ISOLATION_IDS.has(ex.id);

/** Patterns that do not belong on a day, so shoulder work on pull day is rear delts and raises, not presses. */
const OFF_DAY: Record<DayKind, Pattern[]> = {
  full: [],
  upper: [],
  lower: [],
  push: ['hpull', 'vpull'],
  pull: ['hpush', 'vpush'],
  legs: [],
  'abs-focus': [],
};

interface Option {
  ex: Exercise;
  groups: Partial<Record<Group, number>>;
  order: number;
}

interface Placed {
  slot: Slot;
  option: Option;
  group: Group;
}

interface Day {
  title: string;
  kind: DayKind;
  groups: Group[];
  placed: Placed[];
  used: Set<string>;
  direct: Partial<Record<Group, number>>;
  blocked: Set<Group>;
}

/** About 8 hard sets per muscle per session (Pelland 2024), in whole exercises. */
export function maxExercisesPerGroup(p: Pick<AppData['profile'], 'objective' | 'experience'>): number {
  return Math.max(1, Math.round(8 / setsPerExercise(p)));
}

const primaries = (o: Option) => (Object.entries(o.groups) as [Group, number][]).filter(([, w]) => w === 1).map(([g]) => g);
const sameKeys = (a: Group[], b: Group[]) => a.length === b.length && a.every((g) => b.includes(g));

/**
 * Greedy and deterministic: each step gives one exercise to the group furthest
 * below its weekly target (focus groups get a nudge), on the day that has trained
 * it least. Exercise choice prefers a compound for a group's first slot on a day,
 * then avoids piling sets onto groups that are already at target.
 */
export function generatePlan(data: AppData, template: TemplateId, now: string): PlanResult {
  const p = data.profile;
  const weekly = weeklyTargets(p);
  const spe = setsPerExercise(p);
  const maxEx = maxExercisesPerGroup(p);
  const limit = MAX_EXERCISES[p.sessionMinutes];
  const beginner = p.experience === 'beginner';

  const pool: Option[] = allExercises(data)
    .filter((e) => isEligible(e, data) && !e.calisthenics && !V2_ONLY_IDS.has(e.id))
    .map((ex, order) => ({ ex, groups: exerciseGroups(ex), order }));
  const limited = GROUPS.filter((g) => !pool.some((o) => o.groups[g] === 1));
  const achieved = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  const weekUses = new Map<string, number>();

  const days: Day[] = TEMPLATES[template].days.map((d) => ({
    title: d.title,
    kind: d.kind,
    groups: dayGroups(d.kind, weekly.focus).filter((g) => !limited.includes(g)),
    placed: [],
    used: new Set(),
    direct: {},
    blocked: new Set(),
  }));

  // Past the per-session ceiling extra sets add little, so a target never asks for more than its days can hold.
  const anchorSets = prescription(p, 'anchor', undefined).sets;
  const clip = (wanted: Record<Group, number>) =>
    Object.fromEntries(
      GROUPS.map((g) => {
        const options = pool.filter((o) => o.groups[g] === 1);
        const perDay = Math.min(maxEx, options.length) * spe - (options.some((o) => isCompound(o.ex)) ? spe - Math.min(spe, anchorSets) : 0);
        const dayCount = days.filter((d) => d.groups.includes(g)).length;
        return [g, Math.min(wanted[g], dayCount * perDay)];
      }),
    ) as Record<Group, number>;
  const targets: Targets = { ...weekly, sets: clip(weekly.sets) };
  /** What the fill passes aim at: the fitted targets, then the ideal ones when a day has time left. */
  let goal = targets.sets;

  const roleFor = (day: Day, g: Group, o: Option): Slot['role'] =>
    isCompound(o.ex) && !day.placed.some((x) => x.group === g && x.slot.role === 'anchor') ? 'anchor' : 'accessory';
  const setsFor = (role: Slot['role'], o: Option) => prescription(p, role, o.ex).sets;
  const met = (h: Group) => achieved[h] >= goal[h];

  function rank(g: Group, first: boolean) {
    return (a: Option, b: Option) => {
      const shape = (o: Option) => (first ? (isCompound(o.ex) ? 0 : 1) : isCompound(o.ex) ? 1 : 0);
      const spill = (o: Option) => (Object.entries(o.groups) as [Group, number][]).reduce((s, [h, w]) => s + (h !== g && met(h) ? w : 0), 0);
      return (
        shape(a) - shape(b) ||
        spill(a) - spill(b) ||
        (beginner ? BEGINNER_ORDER[a.ex.equipment] - BEGINNER_ORDER[b.ex.equipment] : 0) ||
        (weekUses.get(a.ex.id) ?? 0) - (weekUses.get(b.ex.id) ?? 0) ||
        a.order - b.order
      );
    };
  }

  function pick(day: Day, g: Group): Option | undefined {
    const first = !day.placed.some((x) => x.group === g);
    // Work added outside the day's own groups is a finisher: single-joint only, placed at the end.
    const extra = !day.groups.includes(g);
    const fits = (o: Option) => primaries(o).every((h) => day.placed.filter((x) => x.option.groups[h] === 1).length < maxEx);
    return pool
      .filter((o) => o.groups[g] === 1 && !day.used.has(o.ex.id) && !OFF_DAY[day.kind].includes(o.ex.pattern) && (!extra || !isCompound(o.ex)) && fits(o))
      .sort(rank(g, first))[0];
  }

  function add(day: Day, g: Group, o: Option) {
    const role = roleFor(day, g, o);
    const sets = setsFor(role, o);
    const alternates =
      role === 'accessory'
        ? pool
            .filter((a) => a.ex.id !== o.ex.id && a.ex.pattern === o.ex.pattern && !day.used.has(a.ex.id) && sameKeys(primaries(a), primaries(o)))
            .sort((a, b) => (beginner ? BEGINNER_ORDER[a.ex.equipment] - BEGINNER_ORDER[b.ex.equipment] : 0) || a.order - b.order)
            .slice(0, 2)
        : [];
    const candidates = [o.ex.id, ...alternates.map((a) => a.ex.id)];
    // Only the main pick is reserved; the planner skips an alternate that is already in the day.
    day.used.add(o.ex.id);
    day.placed.push({ slot: { id: newSlotId(), pattern: o.ex.pattern, role, candidates }, option: o, group: g });
    weekUses.set(o.ex.id, (weekUses.get(o.ex.id) ?? 0) + 1);
    for (const [h, w] of Object.entries(o.groups) as [Group, number][]) {
      achieved[h] += sets * w;
      if (w === 1) day.direct[h] = (day.direct[h] ?? 0) + sets;
    }
  }

  // An abs day opens with two or three core exercises (6 to 9 sets).
  if (!limited.includes('abs')) {
    for (const day of days.filter((d) => d.kind === 'abs-focus')) {
      for (let i = 0; i < (limit >= 7 ? 3 : 2); i++) {
        const o = pick(day, 'abs');
        if (o) add(day, 'abs', o);
      }
    }
  }

  // Pass 1 uses each day's own groups. Pass 2 lets unmet focus groups use spare room on any day,
  // like calves or leg curls at the end of an upper day.
  for (const pass of [1, 2] as const) {
    for (const day of days) day.blocked.clear();
    fill(pass === 1 ? (day) => day.groups : () => [...targets.focus].filter((g) => !limited.includes(g)));
  }

  function fill(allowed: (day: Day) => Group[]) {
  for (;;) {
    let best: { day: Day; g: Group; score: number; direct: number; di: number; gi: number } | null = null;
    days.forEach((day, di) => {
      if (day.placed.length >= limit) return;
      for (const g of allowed(day)) {
        if (day.blocked.has(g) || met(g)) continue;
        // Groups below the floor come first (focus before the rest), so a short week shortchanges extras, not basics.
        const urgent = achieved[g] < FLOOR ? (targets.focus.has(g) ? 2 : 1) : 0;
        const score = urgent + (goal[g] - achieved[g]) / goal[g] + (targets.focus.has(g) ? 0.25 : 0);
        const direct = day.direct[g] ?? 0;
        const gi = GROUPS.indexOf(g);
        if (
          !best ||
          score > best.score ||
          (score === best.score && (direct < best.direct || (direct === best.direct && (di < best.di || (di === best.di && gi < best.gi)))))
        )
          best = { day, g, score, direct, di, gi };
      }
    });
    if (!best) break;
    const { day, g } = best as { day: Day; g: Group };
    const o = pick(day, g);
    if (o) add(day, g, o);
    else day.blocked.add(g);
  }
  }

  // Twice a week beats once at the same volume (Schoenfeld 2016). Spill from compounds can meet a
  // target in one day, so give any group hit on fewer than two days one exercise on another of its days.
  const touches = (day: Day, g: Group) => day.placed.some((x) => (x.option.groups[g] ?? 0) > 0);
  for (const g of GROUPS) {
    if (limited.includes(g) || days.filter((d) => touches(d, g)).length >= 2) continue;
    for (const day of days) {
      if (day.placed.length >= limit || !day.groups.includes(g) || touches(day, g)) continue;
      const o = pick(day, g);
      if (o) {
        add(day, g, o);
        break;
      }
    }
  }

  // Fitting trimmed some groups to make room; compound spill often leaves time over. Use it to move
  // each day's own groups back toward their ideal targets, so sessions fill the time the user has.
  goal = clip(idealTargets(p));
  for (const day of days) day.blocked.clear();
  fill((day) => day.groups);

  // A day the user set aside should not be a two-exercise session. Bring each day up to a sensible
  // minimum with its own groups, least-served first, within the per-session caps.
  const minimum = Math.min(limit, Math.max(3, limit - 2));
  for (const day of days) {
    const tried = new Set<Group>();
    while (day.placed.length < minimum) {
      // Focus groups first; a non-focus group only while it is still below its ideal target.
      const open = day.groups.filter((h) => !tried.has(h) && (targets.focus.has(h) || achieved[h] < goal[h]));
      const g = open.sort((a, b) => Number(targets.focus.has(b)) - Number(targets.focus.has(a)) || achieved[a] / goal[a] - achieved[b] / goal[b] || GROUPS.indexOf(a) - GROUPS.indexOf(b))[0];
      if (!g) break;
      const o = pick(day, g);
      if (o) add(day, g, o);
      else tried.add(g);
    }
  }

  const order = (day: Day) => (x: Placed) => {
    const core = x.slot.pattern === 'core';
    const extra = !day.groups.includes(x.group);
    return [core ? (day.kind === 'abs-focus' ? -1 : 2) : extra ? 1 : 0, x.slot.role === 'anchor' ? 0 : 1, targets.focus.has(x.group) ? 0 : 1, isCompound(x.option.ex) ? 0 : 1];
  };
  const cmp = (a: number[], b: number[]) => a.reduce((r, v, i) => r || v - b[i], 0);
  const sessions = days.map((day) => {
    const key = order(day);
    const slots = day.placed
      .map((x, i) => ({ x, i }))
      .sort((a, b) => cmp(key(a.x), key(b.x)) || a.i - b.i)
      .map(({ x }) => x.slot);
    return { title: day.title, slots };
  });

  const daysHit = Object.fromEntries(GROUPS.map((g) => [g, days.filter((d) => d.placed.some((x) => (x.option.groups[g] ?? 0) > 0)).length])) as Record<Group, number>;
  const base = newCustomSplit(data, null, now).split;
  const split: CustomSplit = { ...base, name: `Your plan · ${TEMPLATES[template].name}`, sessions };
  split.blurb = splitBlurb(split);

  return {
    split,
    template,
    targets,
    achieved,
    daysHit,
    short: GROUPS.filter((g) => !limited.includes(g) && achieved[g] < FLOOR),
    limited,
  };
}
