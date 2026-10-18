import { supabase } from '@/sync/client';
import { requestNotifications } from './notify';
import { sameServerKey, urlBase64ToUint8Array, withTimeout, type EnableResult } from './pushUtil';

const TABLE = 'push_subscriptions';
/** Long enough for a cold worker install; short enough that the switch or sign-out never sticks. */
const SW_WAIT_MS = 8000;

const registration = () => withTimeout(navigator.serviceWorker.ready, SW_WAIT_MS);

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function rowFor(userId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * This device's subscription for `key`. One made with an older key is dropped (row and browser side) and replaced,
 * because the push service rejects every send signed with the new key.
 */
async function subscriptionFor(reg: ServiceWorkerRegistration, key: string): Promise<PushSubscription> {
  const bytes = urlBase64ToUint8Array(key);
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameServerKey(existing.options.applicationServerKey, bytes)) return existing;
  if (existing) {
    await supabase.from(TABLE).delete().eq('endpoint', existing.endpoint);
    await existing.unsubscribe();
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes as BufferSource });
}

/** Must be called from a tap (it may show the permission prompt). */
export async function enableReminders(userId: string | null): Promise<EnableResult> {
  if (!userId) return 'signed-out';
  if (!pushSupported()) return 'unsupported';
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) {
    console.warn('VITE_VAPID_PUBLIC_KEY is not set; water reminders cannot subscribe');
    return 'failed';
  }
  try {
    if ((await requestNotifications()) !== 'granted') return 'denied';
    const reg = await registration();
    const sub = await subscriptionFor(reg, key);
    const { error } = await supabase.from(TABLE).upsert(rowFor(userId, sub), { onConflict: 'endpoint' });
    if (error) throw error;
    return 'on';
  } catch {
    return 'failed';
  }
}

export async function disableReminders(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from(TABLE).delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  } catch {
    /* best effort; the flag is off, the server just sends nothing useful */
  }
}

/**
 * Keeps the stored row (and its timezone) current when this device already has a subscription,
 * re-subscribing it if it was made with an older VAPID key. Permission is already granted, so no tap is needed.
 */
export async function refreshSubscription(userId: string): Promise<void> {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!pushSupported() || !key || Notification.permission !== 'granted') return;
  try {
    const reg = await registration();
    if (!(await reg.pushManager.getSubscription())) return;
    const sub = await subscriptionFor(reg, key);
    await supabase.from(TABLE).upsert(rowFor(userId, sub), { onConflict: 'endpoint' });
  } catch {
    /* best effort */
  }
}

/**
 * Drops this device's row before sign-out, while the session still passes RLS, so the old account stops
 * getting nudges and the next account can claim the endpoint. The browser subscription stays for the next sign-in.
 */
export async function removeDeviceRow(): Promise<void> {
  if (!pushSupported()) return;
  try {
    await withTimeout(
      (async () => {
        const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (!sub) return;
        const { error } = await supabase.from(TABLE).delete().eq('endpoint', sub.endpoint);
        if (error) throw error;
      })(),
      SW_WAIT_MS,
    );
  } catch (e) {
    console.warn('Could not remove this device from water reminders', e);
  }
}
