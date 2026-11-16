import type { Group } from './volume';

export type TemplateId = 'full-2' | 'full-3' | 'ul-full' | 'ul-4' | 'ppl-abs' | 'ulppl' | 'ppl-ul' | 'ppl-6';
export type DayKind = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'abs-focus';

export interface Template {
  id: TemplateId;
  name: string;
  days: { title: string; kind: DayKind }[];
}

const day = (title: string, kind: DayKind) => ({ title, kind });
const UPPER = day('Upper', 'upper');
const LOWER = day('Lower', 'lower');
const PUSH = day('Push', 'push');
const PULL = day('Pull', 'pull');
const LEGS = day('Legs', 'legs');

/** Every group lands on at least two days in each template (Schoenfeld 2016: about twice a week). */
export const TEMPLATES: Record<TemplateId, Template> = {
  'full-2': { id: 'full-2', name: 'Full Body', days: [day('Full Body A', 'full'), day('Full Body B', 'full')] },
  'full-3': { id: 'full-3', name: 'Full Body', days: [day('Full Body A', 'full'), day('Full Body B', 'full'), day('Full Body C', 'full')] },
  'ul-full': { id: 'ul-full', name: 'Upper / Lower / Full', days: [UPPER, LOWER, day('Full Body', 'full')] },
  'ul-4': { id: 'ul-4', name: 'Upper / Lower', days: [UPPER, LOWER, UPPER, LOWER] },
  'ppl-abs': { id: 'ppl-abs', name: 'PPL + Abs & focus', days: [PUSH, PULL, LEGS, day('Abs & focus', 'abs-focus')] },
  ulppl: { id: 'ulppl', name: 'Upper / Lower + PPL', days: [UPPER, LOWER, PUSH, PULL, LEGS] },
  'ppl-ul': { id: 'ppl-ul', name: 'PPL + Upper / Lower', days: [PUSH, PULL, LEGS, UPPER, LOWER] },
  'ppl-6': { id: 'ppl-6', name: 'Push / Pull / Legs', days: [PUSH, PULL, LEGS, PUSH, PULL, LEGS] },
};

const BY_DAYS: Record<number, TemplateId> = { 2: 'full-2', 3: 'full-3', 4: 'ul-4', 5: 'ulppl', 6: 'ppl-6' };
const ALTERNATIVES: Record<number, TemplateId[]> = { 3: ['ul-full'], 4: ['ppl-abs'], 5: ['ppl-ul'] };

export function templateFor(days: number): TemplateId {
  return BY_DAYS[Math.min(6, Math.max(2, days))];
}

export function alternativesFor(days: number): TemplateId[] {
  return ALTERNATIVES[days] ?? [];
}

const ALL: Group[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];

export const DAY_GROUPS: Record<Exclude<DayKind, 'abs-focus'>, Group[]> = {
  full: ALL,
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  push: ['chest', 'shoulders', 'triceps', 'abs'],
  // Rear-delt work belongs on pull day.
  pull: ['back', 'biceps', 'shoulders', 'abs'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
};

/** An abs day trains abs, then the user's focus groups, or arms and shoulders when there are none. */
export function dayGroups(kind: DayKind, focus: ReadonlySet<Group>): Group[] {
  if (kind !== 'abs-focus') return DAY_GROUPS[kind];
  const extra = ALL.filter((g) => g !== 'abs' && focus.has(g));
  return ['abs', ...(extra.length ? extra : (['shoulders', 'biceps', 'triceps'] as Group[]))];
}
