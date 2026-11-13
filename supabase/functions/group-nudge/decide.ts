// How a group nudge is delivered. Pure, so vitest drives every rule.
import { localClock } from '../water-nudge/decide.ts';
import { onLeaveDoc } from '../water-nudge/leave.ts';

export type Delivery = 'push' | 'quiet' | 'cheer' | 'capped';

/** At most this many nudge pushes reach one person per local day; the rest wait in the app. */
export const DAILY_PUSH_CAP = 2;
const DEFAULT_WINDOW = { from: 8, to: 21 };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const clockIn = (now: Date, tz: string) => localClock(now, tz) ?? localClock(now, 'UTC')!;

/** The awake window: the water-reminder hours when those are on, otherwise 08:00 to 21:00. */
function awakeWindow(doc: unknown): { from: number; to: number } {
  const w = isObj(doc) && isObj(doc.profile) ? doc.profile.waterReminders : null;
  if (isObj(w) && w.on === true && typeof w.from === 'number' && typeof w.to === 'number' && w.from < w.to) return { from: w.from, to: w.to };
  return DEFAULT_WINDOW;
}

function trainedOn(doc: unknown, date: string, tz: string): boolean {
  if (!isObj(doc) || !Array.isArray(doc.sessions)) return false;
  return doc.sessions.some((s) => isObj(s) && typeof s.finishedAt === 'string' && clockIn(new Date(s.finishedAt), tz).date === date);
}

/** Leave, then already trained (cheer), then quiet hours, then the daily cap. */
export function decideGroupNudge(input: { now: Date; tz: string; doc: unknown; pushesToday: number }): Delivery {
  const tz = localClock(input.now, input.tz) ? input.tz : 'UTC';
  const clock = clockIn(input.now, tz);
  if (onLeaveDoc(input.doc, clock.date)) return 'quiet';
  if (trainedOn(input.doc, clock.date, tz)) return 'cheer';
  const w = awakeWindow(input.doc);
  if (clock.minutes < w.from * 60 || clock.minutes >= w.to * 60) return 'quiet';
  if (input.pushesToday >= DAILY_PUSH_CAP) return 'capped';
  return 'push';
}

/** Midnight of `now`'s local day in `tz`, as a UTC ISO instant. Zone offsets are whole minutes, so seconds carry over. */
export function localDayStartIso(now: Date, tz: string): string {
  const clock = clockIn(now, tz);
  return new Date(now.getTime() - (clock.minutes * 60 + now.getUTCSeconds()) * 1000 - now.getUTCMilliseconds()).toISOString();
}
