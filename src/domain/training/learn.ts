import type { AppData } from '../types';
import type { SplitId } from './types';

/**
 * Signals the app can learn from. Pure reads over finished history; nothing
 * here changes a plan yet. A later release ranks slot candidates with them.
 * See docs/superpowers/specs/2026-11-16-pro-splits-and-learning-design.md.
 */
export interface SwapSignal {
  splitId: SplitId;
  slotId: string;
  /** What the plan picked. */
  from: string;
  /** What the user did instead, most often first. */
  to: { exerciseId: string; count: number; lastAt: string }[];
  /** Times this slot was trained at all, swapped or not. */
  seen: number;
}

/** Per slot: how often the user replaces the planned exercise, and with what. */
export function swapSignals(data: Pick<AppData, 'sessions'>): SwapSignal[] {
  const bySlot = new Map<string, { splitId: SplitId; slotId: string; seen: number; from: Map<string, Map<string, { count: number; lastAt: string }>> }>();
  for (const s of data.sessions) {
    if (!s.splitId || !s.finishedAt) continue;
    for (const e of s.exercises) {
      if (!e.slotId || !e.sets.some((x) => x.status === 'done')) continue;
      const key = `${s.splitId}|${e.slotId}`;
      const entry = bySlot.get(key) ?? { splitId: s.splitId, slotId: e.slotId, seen: 0, from: new Map() };
      entry.seen++;
      if (e.swappedFrom) {
        const to = entry.from.get(e.swappedFrom) ?? new Map();
        const cur = to.get(e.exerciseId);
        to.set(e.exerciseId, { count: (cur?.count ?? 0) + 1, lastAt: cur && cur.lastAt > s.startedAt ? cur.lastAt : s.startedAt });
        entry.from.set(e.swappedFrom, to);
      }
      bySlot.set(key, entry);
    }
  }
  const out: SwapSignal[] = [];
  for (const { splitId, slotId, seen, from } of bySlot.values()) {
    for (const [planned, to] of from) {
      const list = [...to].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
      out.push({ splitId, slotId, from: planned, to: list, seen });
    }
  }
  return out.sort((a, b) => b.to[0].count - a.to[0].count || a.slotId.localeCompare(b.slotId));
}
