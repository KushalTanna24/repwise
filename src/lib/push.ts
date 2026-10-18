import { supabase } from '@/sync/client';
import { requestNotifications } from './notify';
import { urlBase64ToUint8Array, type EnableResult } from './pushUtil';

const TABLE = 'push_subscriptions';

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

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
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource }));
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
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from(TABLE).delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  } catch {
    /* best effort; the flag is off, the server just sends nothing useful */
  }
}

/** Keeps the stored row (and its timezone) current when this device already has a subscription. */
export async function refreshSubscription(userId: string): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from(TABLE).upsert(rowFor(userId, sub), { onConflict: 'endpoint' });
  } catch {
    /* best effort */
  }
}
