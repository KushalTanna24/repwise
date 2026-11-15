import { prescription, type Slot } from '../../training';
import type { Exercise, Profile } from '../../types';

/** Seconds under the bar for a rep set; matches the workout's finish estimate (domain/eta). */
const WORK_SEC = 40;
const WARMUP_MIN = 5;
const MAX_EXERCISES = 10;

/** What one slot costs in the same terms the workout estimate uses: each set's work plus its rest. */
export function slotSeconds(p: Profile, role: Slot['role'], ex?: Exercise): number {
  const rx = prescription(p, role, ex, p.sessionMinutes);
  if (ex?.pattern === 'cardio') return rx.repMin;
  return rx.sets * (WORK_SEC + rx.restSec);
}

/** Time a day may fill: the session length less a warm-up. */
export function dayBudgetSec(p: Profile): number {
  return (p.sessionMinutes - WARMUP_MIN) * 60;
}

/** Exercises that fit a day with two main lifts, capped so a session stays sane. */
export function exerciseLimit(p: Profile): number {
  const left = dayBudgetSec(p) - 2 * slotSeconds(p, 'anchor');
  return Math.max(3, Math.min(MAX_EXERCISES, 2 + Math.floor(left / slotSeconds(p, 'accessory'))));
}
