/** Pure timing rules for notifications and the daily banner. */

export const WARN_BEFORE_MS = 10_000;

/** Delays from `now` for the "10 s left" and "rest over" alerts; null when the moment has passed. */
export function restAlertDelays(endsAt: number, now: number) {
  const warnAt = endsAt - WARN_BEFORE_MS - now;
  const doneAt = endsAt - now;
  return { warn: warnAt > 0 ? warnAt : null, done: doneAt > 0 ? doneAt : null };
}

export const shouldGreet = (lastDate: string | null, today: string) => lastDate !== today;

export function greeting(hour: number) {
  if (hour < 4) return 'Late one';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
