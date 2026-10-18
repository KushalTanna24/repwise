export type EnableResult = 'on' | 'signed-out' | 'denied' | 'unsupported' | 'failed';

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
