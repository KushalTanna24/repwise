// Web Push pieces shared by the edge functions. Kept free of Deno and npm imports so vitest can load it;
// index.ts files pass in the web-push module and the env reader.

export interface PushTarget { endpoint: string; keys: { p256dh: string; auth: string } }

/** A stored device row. `kinds` says which pushes it accepts: 'reminders' (water, streak, fast) and/or 'nudges'. */
export interface SubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; tz: string; last_sent_at: string | null; kinds: string[] }

export const targetOf = (row: SubRow): PushTarget => ({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });

/** The push service says the subscription is gone for good, so the row should be deleted. */
export function isGone(e: unknown): boolean {
  const status = (e as { statusCode?: number } | null)?.statusCode;
  return status === 404 || status === 410;
}

export function configureWebPush(webpush: { setVapidDetails(subject: string, pub: string, priv: string): void }, env: (k: string) => string | undefined): void {
  webpush.setVapidDetails(env('VAPID_SUBJECT')!, env('VAPID_PUBLIC_KEY')!, env('VAPID_PRIVATE_KEY')!);
}
