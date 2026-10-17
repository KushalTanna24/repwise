import { isEmpty, normalize } from '@/domain/migrate';
import type { AppData } from '@/domain/types';

export type Remote = { ok: true; doc: unknown } | { ok: false };
export type SyncDecision = { action: 'push' | 'take' | 'keep' | 'error'; data: AppData };

/**
 * One device, cloud as backup. Rules, in order:
 * a failed or unreadable fetch never counts as empty; an empty side never
 * overwrites a non-empty one; otherwise the newer document wins.
 */
export function resolveSync(local: AppData, remote: Remote, now: string): SyncDecision {
  if (!remote.ok) return { action: 'error', data: local };
  if (remote.doc == null) return { action: 'push', data: local };
  const cloud = normalize(remote.doc, now);
  if (!cloud) return { action: 'error', data: local };
  if (isEmpty(cloud)) return isEmpty(local) ? { action: 'keep', data: local } : { action: 'push', data: local };
  if (isEmpty(local)) return { action: 'take', data: cloud };
  if (cloud.meta.updatedAt > local.meta.updatedAt) return { action: 'take', data: cloud };
  if (cloud.meta.updatedAt < local.meta.updatedAt) return { action: 'push', data: local };
  return { action: 'keep', data: local };
}
