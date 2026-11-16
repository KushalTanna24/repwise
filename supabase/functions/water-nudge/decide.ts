import { waterPace } from './pace.ts';

export type NudgeDecision =
  | { send: false; reason: 'bad-tz' | 'off' | 'window' | 'recent' | 'on-pace' | 'no-data' }
  | { send: true; title: string; body: string; url: '/#/today'; topic: 'water' | 'fast' | 'streak' };

// Cron fires on the hour, so a send stamped a few seconds late must not block the next slot.
const JITTER_MS = 5 * 60_000;

/** Local calendar date and minutes since midnight in `tz`, or null for an unknown zone. */
export function localClock(now: Date, tz: string): { date: string; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const hour = Number(get('hour')) % 24; // some engines print midnight as 24
    return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + Number(get('minute')) };
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function decideNudge(input: { now: Date; tz: string; lastSentAt: string | null; doc: unknown }): NudgeDecision {
  const clock = localClock(input.now, input.tz);
  if (!clock) return { send: false, reason: 'bad-tz' };
  const doc = input.doc;
  if (!isObj(doc) || !isObj(doc.profile)) return { send: false, reason: 'no-data' };
  const profile = doc.profile;
  const r = isObj(profile.waterReminders) ? profile.waterReminders : {};
  if (r.on !== true) return { send: false, reason: 'off' };
  const from = num(r.from, 9);
  const to = num(r.to, 21);
  const everyHours = num(r.everyHours, 2);
  const goal = num(profile.waterGoal, 0);
  const glasses = isObj(doc.water) ? num(doc.water[clock.date], 0) : 0;

  const pace = waterPace(glasses, goal, clock.minutes, { from, to });
  if (!pace.inWindow) return { send: false, reason: 'window' };
  if (input.lastSentAt) {
    const elapsed = input.now.getTime() - new Date(input.lastSentAt).getTime();
    if (elapsed < everyHours * 3_600_000 - JITTER_MS) return { send: false, reason: 'recent' };
  }
  if (pace.behind < 1) return { send: false, reason: 'on-pace' };
  return { send: true, title: 'Time for water', body: `${glasses} of ${goal} glasses. You're ${pace.behind} behind, have one now.`, url: '/#/today', topic: 'water' };
}
