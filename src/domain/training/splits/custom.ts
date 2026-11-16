import type { AppData } from '../../types';
import { clampRotation } from '../rotation';
import type { CustomSplit, CustomSplitId, SplitDef, SplitId } from '../types';
import { getSplit } from './registry';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomChars(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function newSlotId(): string {
  return `cs-${randomChars(8)}`;
}

/** A draft. Nothing is stored until `saveCustomSplit`. */
export function newCustomSplit(data: AppData, from: SplitId | null, now: string, id: CustomSplitId = `custom-${crypto.randomUUID()}`): { split: CustomSplit } {
  const source = from ? getSplit(data, from) : undefined;
  const base = { id, custom: true as const, createdAt: now, updatedAt: now };
  if (!source) {
    return { split: { ...base, name: 'My split', blurb: '', sessions: [{ title: 'Day 1', slots: [] }] } };
  }
  const sessions = structuredClone(source.sessions).map((s) => ({ ...s, slots: s.slots.map((slot) => ({ ...slot, id: newSlotId() })) }));
  return { split: { ...base, name: `My ${source.name}`, blurb: '', copiedFrom: source.id, sessions } };
}

export function validateSplit(split: SplitDef): string | null {
  if (!split.name.trim()) return 'Give your split a name';
  if (split.sessions.length < 1 || split.sessions.length > 7) return 'A split needs 1 to 7 days';
  if (split.sessions.some((s) => !s.title.trim())) return 'Give every day a name';
  if (split.sessions.some((s) => s.slots.length < 1)) return 'Give every day at least one exercise';
  if (split.sessions.some((s) => s.slots.length > 12)) return 'Keep each day to 12 exercises or fewer';
  return null;
}

export function splitBlurb(split: SplitDef): string {
  const n = split.sessions.length;
  return `${n} ${n === 1 ? 'day' : 'days'} · ${split.sessions.map((s) => s.short ?? s.title).join(' / ')}`;
}

export function saveCustomSplit(data: AppData, split: CustomSplit, now: string): AppData {
  if (validateSplit(split)) return data;
  const saved: CustomSplit = { ...split, updatedAt: now, blurb: splitBlurb(split) };
  const exists = data.customSplits.some((s) => s.id === saved.id);
  const customSplits = exists ? data.customSplits.map((s) => (s.id === saved.id ? saved : s)) : [...data.customSplits, saved];
  let next = clampRotation({ ...data, customSplits }, saved.id);
  if (next.program.splitId === saved.id && !next.activeSession) next = { ...next, plannedSession: null };
  return next;
}

export function deleteCustomSplit(data: AppData, id: CustomSplitId, now: string): AppData {
  const active = data.program.splitId === id;
  if (active && data.activeSession) return data;
  const customSplits = data.customSplits.map((s) => (s.id === id ? { ...s, deletedAt: now } : s));
  const next = { ...data, customSplits };
  return active ? { ...next, plannedSession: null, program: { ...next.program, splitId: null } } : next;
}
