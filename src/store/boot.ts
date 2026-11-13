import { get } from 'idb-keyval';
import { normalize } from '@/domain/migrate';
import { STORE_KEY, useApp } from './app';

const LEGACY_KEYS = ['repwise_v2', 'repwise_progression_v3'] as const;

function backupLegacy() {
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw && !localStorage.getItem(`${key}_backup`)) localStorage.setItem(`${key}_backup`, raw);
    } catch {
      /* storage blocked: nothing to back up */
    }
  }
}

const hydrated = () =>
  new Promise<void>((resolve) => (useApp.persist.hasHydrated() ? resolve() : useApp.persist.onFinishHydration(() => resolve())));

/**
 * First-run migration. Runs once per device: after the v4 document exists
 * this is a no-op. repwise_v2 itself is never modified or deleted.
 */
export async function boot() {
  backupLegacy();
  const hadV4 = !!(await get(STORE_KEY));
  await hydrated();
  if (!hadV4) {
    try {
      const raw = localStorage.getItem('repwise_v2');
      const data = raw ? normalize(JSON.parse(raw), new Date().toISOString()) : null;
      if (data) useApp.getState().replace(data);
    } catch {
      /* unreadable legacy data stays in repwise_v2_backup */
    }
  }
  navigator.storage?.persist?.().catch(() => {});
}
