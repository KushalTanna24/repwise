import { localClock, type NudgeDecision } from './decide.ts';

const EIGHT_PM = 20 * 60;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const dayBefore = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/**
 * 8 pm nudge when today isn't lit yet. The app writes `streakHint` on every change; a hint from
 * yesterday that was lit means the app hasn't been opened today, so today is still unlit.
 */
export function decideStreak(input: { now: Date; tz: string; doc: unknown }): NudgeDecision {
  const clock = localClock(input.now, input.tz);
  if (!clock) return { send: false, reason: 'bad-tz' };
  const doc = input.doc;
  if (!isObj(doc) || !isObj(doc.streakHint)) return { send: false, reason: 'no-data' };
  if (isObj(doc.profile) && doc.profile.streakReminder === false) return { send: false, reason: 'off' };
  if (clock.minutes < EIGHT_PM || clock.minutes >= EIGHT_PM + 60) return { send: false, reason: 'window' };

  const { date, current, lit } = doc.streakHint;
  const atRisk = (date === clock.date && lit === false) || (date === dayBefore(clock.date) && lit === true);
  if (typeof current !== 'number' || current < 3 || !atRisk) return { send: false, reason: 'on-pace' };
  return { send: true, title: `${current}-day streak`, body: `Your ${current}-day streak ends at midnight. One goal keeps it alive.`, url: '/#/today', topic: 'streak' };
}
