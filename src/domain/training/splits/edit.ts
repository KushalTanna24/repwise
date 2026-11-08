import type { Exercise } from '../../types';
import type { CustomSplit, Slot } from '../types';
import { newSlotId } from './custom';

type Day = CustomSplit['sessions'][number];

const MAX_DAYS = 7;
const MAX_SLOTS = 12;
const MAX_ALTERNATES = 2;

/** Replace one day; the same split comes back when the day does not exist. */
function withDay(split: CustomSplit, day: number, fn: (d: Day) => Day): CustomSplit {
  const cur = split.sessions[day];
  if (!cur) return split;
  const next = fn(cur);
  if (next === cur) return split;
  return { ...split, sessions: split.sessions.map((d, i) => (i === day ? next : d)) };
}

function withSlot(split: CustomSplit, day: number, idx: number, fn: (s: Slot) => Slot): CustomSplit {
  return withDay(split, day, (d) => {
    const cur = d.slots[idx];
    if (!cur) return d;
    const next = fn(cur);
    return next === cur ? d : { ...d, slots: d.slots.map((s, i) => (i === idx ? next : s)) };
  });
}

function reorder<T>(list: T[], from: number, to: number): T[] | null {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return null;
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item as T);
  return out;
}

const onDay = (d: Day, id: string) => d.slots.some((s) => s.candidates.includes(id));

export function addDay(split: CustomSplit): CustomSplit {
  if (split.sessions.length >= MAX_DAYS) return split;
  return { ...split, sessions: [...split.sessions, { title: `Day ${split.sessions.length + 1}`, slots: [] }] };
}

export function removeDay(split: CustomSplit, day: number): CustomSplit {
  if (split.sessions.length <= 1 || !split.sessions[day]) return split;
  return { ...split, sessions: split.sessions.filter((_, i) => i !== day) };
}

export function moveDay(split: CustomSplit, from: number, to: number): CustomSplit {
  const sessions = reorder(split.sessions, from, to);
  return sessions ? { ...split, sessions } : split;
}

export function renameDay(split: CustomSplit, day: number, title: string): CustomSplit {
  return withDay(split, day, (d) => (d.title === title ? d : { ...d, title }));
}

export function addEntry(split: CustomSplit, day: number, ex: Pick<Exercise, 'id' | 'pattern'>, role: Slot['role'] = 'accessory'): CustomSplit {
  return withDay(split, day, (d) => {
    if (d.slots.length >= MAX_SLOTS || onDay(d, ex.id)) return d;
    return { ...d, slots: [...d.slots, { id: newSlotId(), role, pattern: ex.pattern, candidates: [ex.id] }] };
  });
}

export function removeEntry(split: CustomSplit, day: number, slotIdx: number): CustomSplit {
  return withDay(split, day, (d) => (d.slots[slotIdx] ? { ...d, slots: d.slots.filter((_, i) => i !== slotIdx) } : d));
}

export function moveEntry(split: CustomSplit, day: number, from: number, to: number): CustomSplit {
  return withDay(split, day, (d) => {
    const slots = reorder(d.slots, from, to);
    return slots ? { ...d, slots } : d;
  });
}

export function setRole(split: CustomSplit, day: number, slotIdx: number, role: Slot['role']): CustomSplit {
  return withSlot(split, day, slotIdx, (s) => {
    if (s.role === role) return s;
    return role === 'anchor' ? { ...s, role, candidates: s.candidates.slice(0, 1) } : { ...s, role };
  });
}

export function addAlternate(split: CustomSplit, day: number, slotIdx: number, exerciseId: string): CustomSplit {
  const cur = split.sessions[day];
  if (!cur || onDay(cur, exerciseId)) return split;
  return withSlot(split, day, slotIdx, (s) => {
    if (s.role === 'anchor' || s.candidates.length - 1 >= MAX_ALTERNATES) return s;
    return { ...s, candidates: [...s.candidates, exerciseId] };
  });
}

export function removeAlternate(split: CustomSplit, day: number, slotIdx: number, exerciseId: string): CustomSplit {
  return withSlot(split, day, slotIdx, (s) => {
    const at = s.candidates.indexOf(exerciseId);
    return at < 1 ? s : { ...s, candidates: s.candidates.filter((_, i) => i !== at) };
  });
}

export function fillDay(split: CustomSplit, day: number, slots: Slot[]): CustomSplit {
  return withDay(split, day, (d) => (d.slots.length > 0 || slots.length === 0 ? d : { ...d, slots }));
}
