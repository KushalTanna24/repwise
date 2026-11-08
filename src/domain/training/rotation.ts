import type { AppData } from '../types';
import { getSplit } from './splits/registry';
import type { RotationState, SplitId } from './types';

function withRotation(data: AppData, id: SplitId, next: RotationState): AppData {
  return { ...data, program: { ...data.program, rotation: { ...data.program.rotation, [id]: next } } };
}

/** A missing entry means day 1, cycle 1. */
export function currentRotation(data: AppData, id: SplitId): RotationState {
  return data.program.rotation[id] ?? { sessionIndex: 0, cycle: 1 };
}

/** Moves to the next day, wrapping into the next cycle, and drops the planned session. */
export function advanceRotation(data: AppData, id: SplitId): AppData {
  const split = getSplit(data, id);
  if (!split) return data;
  const len = split.sessions.length;
  const cur = currentRotation(data, id);
  const next = cur.sessionIndex + 1 >= len ? { sessionIndex: 0, cycle: cur.cycle + 1 } : { sessionIndex: cur.sessionIndex + 1, cycle: cur.cycle };
  return { ...withRotation(data, id, next), plannedSession: null };
}

export function skipDay(data: AppData): AppData {
  const id = data.program.splitId;
  if (data.activeSession || !id) return data;
  return advanceRotation(data, id);
}

export function setSplit(data: AppData, id: SplitId): AppData {
  if (data.activeSession) return data;
  return { ...data, plannedSession: null, program: { ...data.program, splitId: id } };
}

/** After a long break: back to day 1 of the next cycle. */
export function restartAfterBreak(data: AppData, id: SplitId): AppData {
  return withRotation(data, id, { sessionIndex: 0, cycle: currentRotation(data, id).cycle + 1 });
}

/** After a split loses days: keep the cycle, cap the day. */
export function clampRotation(data: AppData, id: SplitId): AppData {
  const split = getSplit(data, id);
  if (!split) return data;
  const days = split.sessions.length;
  const cur = currentRotation(data, id);
  return withRotation(data, id, { sessionIndex: Math.min(cur.sessionIndex, days - 1), cycle: cur.cycle });
}
