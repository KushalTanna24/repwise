import { ALL_EQUIPMENT, BUILTIN_EXERCISES, emptyAppData } from './catalogue';
import { seedStack } from './supplementCatalogue';
import type { AppData, EquipmentKind, Exercise, Objective, Profile, SessionExercise, WorkoutSession } from './types';

/* Shapes written by the legacy single-file app (localStorage key repwise_v2). */
interface V2Set {
  name: string;
  group?: string;
  load?: number;
  reps?: number;
}
interface V2State {
  profile?: Record<string, string>;
  sessions: { id?: string; date: string; split?: string; sets: V2Set[] }[];
  weights?: { date: string; weight: number }[];
}

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function lookupByName(name: string): Exercise | undefined {
  const n = name.trim().toLowerCase();
  return BUILTIN_EXERCISES.find((e) => e.name.toLowerCase() === n || e.aliases?.some((a) => a.toLowerCase() === n));
}

const GROUP_PATTERN: Record<string, Exercise['pattern']> = {
  Chest: 'hpush',
  Back: 'hpull',
  Shoulders: 'shoulders',
  Legs: 'knee',
  Core: 'core',
  Skill: 'vpull',
};

function customFrom(name: string, group: string | undefined, weighted: boolean): Exercise {
  return {
    id: `custom-${slug(name)}`,
    name: name.trim(),
    muscle: group && group !== 'Custom' ? group : 'Custom',
    pattern: GROUP_PATTERN[group ?? ''] ?? 'core',
    equipment: weighted ? 'dumbbell' : 'bodyweight',
    kind: weighted ? 'weighted' : 'bodyweight',
    custom: true,
  };
}

function isV2(x: unknown): x is V2State {
  const s = x as V2State;
  return !!s && typeof s === 'object' && Array.isArray(s.sessions) && !('schemaVersion' in s) && s.sessions.every((q) => q && Array.isArray(q.sets));
}

function isV4(x: unknown): x is AppData {
  const d = x as AppData;
  return !!d && typeof d === 'object' && d.schemaVersion === 4 && Array.isArray(d.sessions) && Array.isArray(d.bodyweights) && !!d.program && !!d.profile;
}

function v2Profile(p: Record<string, string> | undefined, base: Profile): Profile {
  if (!p) return base;
  const goal = p.goal ?? '';
  const objective: Objective = /strength/i.test(goal) ? 'strength' : /hypertrophy/i.test(goal) || !goal ? 'hypertrophy' : 'general';
  const eq = p.equipment ?? 'Full gym';
  const equipment: EquipmentKind[] =
    eq === 'Full gym' ? [...ALL_EQUIPMENT] : /dumbbell|home/i.test(eq) ? ['dumbbell', 'bodyweight'] : ['bodyweight'];
  const days = Number(p.days);
  const excluded = (p.excluded ?? '')
    .split(',')
    .map((s) => lookupByName(s)?.id)
    .filter((id): id is string => !!id);
  const exp = (p.experience ?? '').toLowerCase();
  return {
    ...base,
    objective,
    equipment,
    excludedExerciseIds: excluded,
    daysPerWeek: days >= 2 && days <= 6 ? days : base.daysPerWeek,
    experience: exp === 'beginner' || exp === 'advanced' ? exp : 'intermediate',
    ...(goal ? { goalNote: goal } : {}),
  };
}

/** Deterministic mapping of legacy data. Old sets become done sets with no target. */
export function migrateV2(raw: unknown, now: string): AppData {
  const v2 = raw as V2State;
  const base = emptyAppData(now);
  const custom = new Map<string, Exercise>();

  const idFor = (set: V2Set) => {
    const known = lookupByName(set.name);
    if (known) return known.id;
    const c = custom.get(slug(set.name)) ?? customFrom(set.name, set.group, (set.load ?? 0) > 0);
    custom.set(slug(set.name), c);
    return c.id;
  };

  const sessions: WorkoutSession[] = v2.sessions.map((s, i) => {
    const groups = new Map<string, SessionExercise>();
    for (const set of s.sets) {
      if (!set?.name) continue;
      const id = idFor(set);
      const entry = groups.get(id) ?? { exerciseId: id, slotId: null, plan: null, rec: null, sets: [] };
      entry.sets.push({ targetKg: null, targetReps: null, actualKg: Number(set.load) || 0, actualReps: Number(set.reps) || 0, status: 'done' });
      groups.set(id, entry);
    }
    const at = `${s.date}T12:00:00.000Z`;
    return {
      id: s.id ?? `v2-${s.date}-${i}`,
      planKey: null,
      splitId: null,
      sessionIndex: null,
      cycle: null,
      title: s.split ?? 'Workout',
      startedAt: at,
      finishedAt: at,
      exercises: [...groups.values()],
    };
  });

  for (const name of (v2.profile?.customNames ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!lookupByName(name) && !custom.has(slug(name))) custom.set(slug(name), customFrom(name, 'Custom', false));
  }

  return {
    ...base,
    profile: v2Profile(v2.profile, base.profile),
    customExercises: [...custom.values()],
    sessions,
    bodyweights: (v2.weights ?? [])
      .filter((w) => w && typeof w.weight === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(w.date))
      .map((w) => ({ id: `w-${w.date}`, date: w.date, kg: w.weight })),
    meta: { ...base.meta, updatedAt: now, migratedFrom: 'repwise_v2', migratedAt: now },
  };
}

/** Any supported document shape to v4, or null when it isn't Repwise data. */
export function normalize(doc: unknown, now: string): AppData | null {
  if (isV4(doc)) {
    const base = emptyAppData(now);
    // The seeded stack in base must not leak into a doc that has none; seedStack decides that once.
    return seedStack({
      ...base,
      ...doc,
      supplements: doc.supplements ?? [],
      leave: doc.leave ?? [],
      challenges: doc.challenges ?? [],
      fasts: doc.fasts ?? [],
      photos: doc.photos ?? [],
      // Missing (pre-4.3) stays missing so the store can back-fill earned badges silently.
      seenBadges: doc.seenBadges,
      streakHint: doc.streakHint ?? null,
      profile: { ...base.profile, ...doc.profile },
      program: { ...base.program, ...doc.program, rotation: { ...base.program.rotation, ...doc.program.rotation } },
    });
  }
  const wrapped = doc as { version?: number; state?: unknown };
  if (wrapped && typeof wrapped === 'object' && wrapped.state !== undefined && isV2(wrapped.state)) return migrateV2(wrapped.state, now);
  if (isV2(doc)) return migrateV2(doc, now);
  return null;
}

export type ImportResult =
  | { ok: true; data: AppData; summary: { sessions: number; bodyweights: number; from?: string; to?: string } }
  | { ok: false; error: string };

export function parseImport(json: string, now: string): ImportResult {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }
  const v = (doc as { schemaVersion?: unknown })?.schemaVersion;
  if (typeof v === 'number' && v > 4) return { ok: false, error: 'This backup is from a newer version of Repwise.' };
  const data = normalize(doc, now);
  if (!data) return { ok: false, error: "This file isn't a Repwise backup." };
  const dates = [...data.sessions.map((s) => s.startedAt.slice(0, 10)), ...data.bodyweights.map((w) => w.date)].sort();
  return {
    ok: true,
    data,
    summary: { sessions: data.sessions.length, bodyweights: data.bodyweights.length, ...(dates.length ? { from: dates[0], to: dates.at(-1) } : {}) },
  };
}

export function isEmpty(data: AppData): boolean {
  // Anything a user built up counts, or sync would let an empty device overwrite it.
  const lists = [data.sessions, data.bodyweights, data.extras, data.challenges ?? [], data.fasts ?? [], data.leave ?? [], data.photos ?? []];
  return lists.every((l) => l.length === 0);
}
