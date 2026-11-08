import type { AppData } from '../../types';
import type { CustomSplit, Slot, SplitDef, SplitId } from '../types';
import { BUILT_IN_SPLITS } from './builtins';

/** Appended after a session's own slots when it lacks the pattern; longer sessions reach them. Built-in splits only. */
export const FINISHERS: Slot[] = [
  { id: 'f-calves', pattern: 'calves', role: 'accessory', candidates: ['standing-calf-raise', 'seated-calf-raise'] },
  { id: 'f-core', pattern: 'core', role: 'accessory', candidates: ['hanging-knee-raise', 'plank', 'cable-crunch', 'dead-bug'] },
  { id: 'f-arms', pattern: 'arms', role: 'accessory', candidates: ['db-curl', 'triceps-pushdown', 'hammer-curl', 'cable-curl'] },
];

/** Built-ins first, then custom splits including deleted ones, which stay resolvable for history and swaps. */
export function getSplit(data: AppData, id: SplitId): SplitDef | undefined {
  if (Object.hasOwn(BUILT_IN_SPLITS, id)) return BUILT_IN_SPLITS[id as keyof typeof BUILT_IN_SPLITS];
  return data.customSplits.find((s) => s.id === id);
}

export function listSplits(data: AppData): { builtIn: SplitDef[]; custom: CustomSplit[] } {
  return {
    builtIn: Object.values(BUILT_IN_SPLITS),
    custom: data.customSplits.filter((s) => !s.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export function findSlot(data: AppData, splitId: SplitId | null, slotId: string | null): Slot | undefined {
  if (!splitId || !slotId) return undefined;
  const split = getSplit(data, splitId);
  if (!split) return undefined;
  return [...split.sessions.flatMap((s) => s.slots), ...FINISHERS].find((s) => s.id === slotId);
}
