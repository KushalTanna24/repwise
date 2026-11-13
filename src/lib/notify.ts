import { create } from 'zustand';

export type Permission = NotificationPermission | 'unsupported';

const supported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export const useNotifyPermission = create<{ permission: Permission }>(() => ({
  permission: supported() ? Notification.permission : 'unsupported',
}));

/** Must be called from a tap: Chrome ignores permission prompts that aren't user-initiated. */
export async function requestNotifications(): Promise<Permission> {
  if (!supported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  useNotifyPermission.setState({ permission });
  return permission;
}

/**
 * Android Chrome only shows notifications through the service worker.
 * `url` is opened (or focused) when the notification is tapped.
 */
export async function notify(title: string, body: string, tag: string, url = '/#/today/workout') {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url },
      // @ts-expect-error renotify and vibrate are supported on Android Chrome but missing from lib.dom
      renotify: true,
      vibrate: [200, 100, 200],
    });
  } catch {
    /* best effort */
  }
}