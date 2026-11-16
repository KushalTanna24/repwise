export type EnableResult = 'on' | 'signed-out' | 'denied' | 'unsupported' | 'failed';

/** What a device accepts: reminders (water, streak, fast) and/or group nudges. Each is its own opt-in. */
export type PushKind = 'reminders' | 'nudges';
const KINDS: PushKind[] = ['nudges', 'reminders'];

/** The device's kinds after turning `kind` on or off; sorted, unique, known kinds only. */
export function nextKinds(current: string[] | null, kind: PushKind, on: boolean): PushKind[] {
  const set = new Set((current ?? []).filter((k): k is PushKind => (KINDS as string[]).includes(k)));
  if (on) set.add(kind);
  else set.delete(kind);
  return KINDS.filter((k) => set.has(k));
}

/** VAPID public keys travel as URL-safe base64; pushManager.subscribe wants raw bytes. */
export function urlBase64ToUint8Array(s: string): Uint8Array {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** What the switch should do after an enable attempt, and what to tell the user if it stays off. */
export function reminderToggle(result: EnableResult): { on: boolean; message: string | null } {
  switch (result) {
    case 'on':
      return { on: true, message: null };
    case 'signed-out':
      return { on: false, message: 'Sign in to get water reminders' };
    case 'denied':
      return { on: false, message: 'Notifications are blocked. Allow them in Chrome site settings, then come back' };
    case 'unsupported':
      return { on: false, message: 'Install Repwise to your home screen to get reminders' };
    case 'failed':
      return { on: false, message: "Couldn't turn on reminders. Try again" };
  }
}

/** Rejects if `p` hasn't settled in `ms`. navigator.serviceWorker.ready never settles without a worker. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

/** True when a subscription's applicationServerKey is `key`. A rotated VAPID key makes old subscriptions unusable. */
export function sameServerKey(subKey: ArrayBuffer | null, key: Uint8Array): boolean {
  if (!subKey) return false;
  const a = new Uint8Array(subKey);
  return a.length === key.length && a.every((b, i) => b === key[i]);
}
