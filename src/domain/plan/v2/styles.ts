import { GROUPS, type DayLayout, type Group, type StyleId } from './groups';
import type { Targets } from './targets';

export type { DayLayout, StyleId };
export type FixedStyle = Exclude<StyleId, 'custom'>;

/** Under this many times a week a muscle is held more than grown (per-session cap, Pelland 2024). */
export const LOW_FREQ = 1.3;
/** "Let Repwise pick" wants focus muscles at least this often. */
const FOCUS_FREQ = 1.5;

export const STYLE_NAME: Record<StyleId, string> = {
  full: 'Full Body',
  'upper-lower': 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
  'hybrid-ppl': 'Hybrid PPL',
  arnold: 'Arnold split',
  pairs: 'Pairs',
  bro: 'Bro split',
  custom: 'Custom pairs',
};

const day = (title: string, groups: Group[], cardio = false): DayLayout => (cardio ? { title, groups, cardio } : { title, groups });

const ALL: Group[] = GROUPS.filter((g) => g !== 'front-delts');
const UPPER: Group[] = ['upper-chest', 'chest', 'lats', 'upper-back', 'traps', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'forearms', 'neck'];
const LEGS: Group[] = ['quads', 'hamstrings', 'glutes', 'calves', 'abs'];
const PUSH: Group[] = ['upper-chest', 'chest', 'side-delts', 'triceps', 'abs'];
const PULL: Group[] = ['lats', 'upper-back', 'traps', 'rear-delts', 'biceps', 'forearms', 'neck'];
const ARMS_DELTS: Group[] = ['side-delts', 'rear-delts', 'biceps', 'triceps', 'forearms', 'neck'];

const full = (n: number) => ['A', 'B', 'C'].slice(0, n).map((x) => day(`Full Body ${x}`, ALL));
const ppl = [day('Push', PUSH), day('Pull', PULL), day('Legs', LEGS)];
const arnold = [day('Chest + Back', ['upper-chest', 'chest', 'lats', 'upper-back', 'traps', 'abs']), day('Shoulders + Arms', ARMS_DELTS), day('Legs', LEGS)];
const chestBiceps = day('Chest + Biceps', ['upper-chest', 'chest', 'biceps', 'forearms']);
const backTriceps = day('Back + Triceps', ['lats', 'upper-back', 'traps', 'triceps', 'neck']);
const cardioAbs = day('Cardio + Abs', ['abs'], true);

const LAYOUTS: Record<FixedStyle, { days: number[]; layout: (days: number) => DayLayout[] }> = {
  full: { days: [2, 3], layout: (n) => full(n) },
  'upper-lower': {
    days: [3, 4],
    layout: (n) => (n === 3 ? [day('Upper', UPPER), day('Lower', LEGS), day('Full Body', ALL)] : [day('Upper', UPPER), day('Lower', LEGS), day('Upper', UPPER), day('Lower', LEGS)]),
  },
  ppl: { days: [3, 6], layout: (n) => (n === 6 ? [...ppl, ...ppl] : ppl) },
  'hybrid-ppl': {
    days: [4, 5],
    layout: (n) => (n === 4 ? [...ppl, day('Arms & delts', ARMS_DELTS)] : [...ppl, day('Upper', UPPER), day('Lower', LEGS)]),
  },
  arnold: { days: [3, 6], layout: (n) => (n === 6 ? [...arnold, ...arnold] : arnold) },
  pairs: {
    days: [4, 5, 6],
    layout: (n) =>
      n === 4
        ? [chestBiceps, backTriceps, day('Shoulders + Legs', ['side-delts', 'rear-delts', 'quads', 'hamstrings', 'glutes', 'calves']), cardioAbs]
        : [chestBiceps, backTriceps, day('Shoulders', ['side-delts', 'rear-delts', 'neck']), day('Legs', ['quads', 'hamstrings', 'glutes', 'calves']), cardioAbs],
  },
  bro: {
    days: [5, 6],
    layout: () => [
      day('Chest', ['upper-chest', 'chest', 'abs']),
      day('Back', ['lats', 'upper-back', 'traps', 'neck']),
      day('Shoulders', ['side-delts', 'rear-delts', 'abs']),
      day('Arms', ['biceps', 'triceps', 'forearms']),
      day('Legs', ['quads', 'hamstrings', 'glutes', 'calves']),
    ],
  },
};

/** Simplest first; ties in "Let Repwise pick" go to the earlier style. */
const ORDER: FixedStyle[] = ['full', 'upper-lower', 'ppl', 'hybrid-ppl', 'arnold', 'pairs', 'bro'];

export function eligibleStyles(daysPerWeek: number): StyleId[] {
  return [...ORDER.filter((s) => LAYOUTS[s].days.includes(daysPerWeek)), 'custom'];
}

export function styleLayout(id: FixedStyle, daysPerWeek: number): DayLayout[] {
  return LAYOUTS[id].layout(daysPerWeek).map((d) => ({ ...d, groups: [...d.groups] }));
}

/** Times a week each group is trained: Repwise rotates the cycle, so a 4-day cycle trained 5 days hits a day 1.25 times a week. */
export function frequency(layout: DayLayout[], daysPerWeek: number): Record<Group, number> {
  const n = Math.max(1, layout.length);
  return Object.fromEntries(GROUPS.map((g) => [g, (layout.filter((d) => d.groups.includes(g)).length * daysPerWeek) / n])) as Record<Group, number>;
}

function styleScore(layout: DayLayout[], daysPerWeek: number, t: Targets): number {
  const f = frequency(layout, daysPerWeek);
  const trained = GROUPS.filter((g) => t.sets[g] > 0);
  const focus = [...t.focus].filter((g) => t.sets[g] > 0);
  const share = (gs: Group[], min: number) => (gs.length ? gs.filter((g) => f[g] >= min).length / gs.length : 1);
  const crowded = layout.some((d) => d.groups.filter((g) => t.sets[g] > 0).length > t.exerciseLimit);
  return 2 * share(focus, FOCUS_FREQ) + share(trained, LOW_FREQ) - (crowded ? 0.5 : 0);
}

export function pickStyle(daysPerWeek: number, targets: Targets): FixedStyle {
  const options = eligibleStyles(daysPerWeek).filter((s): s is FixedStyle => s !== 'custom');
  let best = options[0] ?? 'full';
  let bestScore = -Infinity;
  for (const s of options) {
    const score = styleScore(styleLayout(s, daysPerWeek), daysPerWeek, targets);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

export interface PairsCheck {
  missing: Group[];
  lowFrequency: Group[];
  emptyDays: number[];
  ok: boolean;
}

/** `cardioOk` is false when no cardio exercise fits the equipment, so a cardio-only day would be empty. */
export function validateCustomPairs(days: DayLayout[], targets: Targets, daysPerWeek: number, cardioOk = true): PairsCheck {
  const f = frequency(days, daysPerWeek);
  const listed = new Set(days.flatMap((d) => d.groups));
  const missing = GROUPS.filter((g) => targets.sets[g] > 0 && !listed.has(g));
  const lowFrequency = GROUPS.filter((g) => targets.sets[g] > 0 && listed.has(g) && f[g] < LOW_FREQ);
  // A day of muscles with no weekly target builds no exercises.
  const emptyDays = days.flatMap((d, i) => (!d.groups.some((g) => targets.sets[g] > 0) && !(d.cardio && cardioOk) ? [i] : []));
  const ok = days.length >= 2 && days.length <= 7 && missing.length === 0 && emptyDays.length === 0;
  return { missing, lowFrequency, emptyDays, ok };
}
