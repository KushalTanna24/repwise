import type { AppData, Profile } from '../types';

/**
 * What a group sees of a member. The server function `member_doc` in
 * supabase/migrations/20261113000000_groups.sql strips the same keys; keep the two lists in step.
 */
export const BODY_PROFILE_KEYS = ['heightCm', 'targetWeightKg', 'sex', 'birthYear', 'activity', 'bodyGoal', 'intakeKcal', 'goalNote'] as const satisfies readonly (keyof Profile)[];
export const BODY_ARRAY_KEYS = ['bodyweights', 'photos', 'fasts', 'supplements', 'suppLog'] as const;

/** A member's document as one group may see it. Never mutates `doc`. */
export function stripForGroup(doc: AppData, shareBody: boolean): AppData {
  const profile: Partial<Profile> = { ...doc.profile };
  delete profile.displayName;
  if (!shareBody) for (const k of BODY_PROFILE_KEYS) delete profile[k];

  const out: AppData = { ...doc, profile: profile as Profile, exerciseNotes: {} };
  if (!shareBody) {
    out.bodyweights = [];
    out.photos = [];
    out.fasts = [];
    out.supplements = [];
    out.suppLog = {};
  }
  if (doc.activeSession) out.activeSession = { ...doc.activeSession, exercises: doc.activeSession.exercises.map((e) => ({ ...e, sets: [] })) };
  return out;
}
