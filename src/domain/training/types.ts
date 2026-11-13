import type { Kg, Pattern } from '../types';

export type BuiltInSplitId = 'full-body-abc' | 'upper-lower' | 'ppl' | 'ppl-hybrid';
export type CustomSplitId = `custom-${string}`;
export type SplitId = BuiltInSplitId | CustomSplitId;

export interface Slot {
  id: string;
  pattern: Pattern;
  role: 'anchor' | 'accessory';
  candidates: string[];
}

export interface SplitDef {
  id: SplitId;
  name: string;
  blurb: string;
  custom?: true;
  /** `short` names the day in one-line summaries when the title's last word would not. */
  sessions: { title: string; short?: string; slots: Slot[] }[];
}

export interface CustomSplit extends SplitDef {
  id: CustomSplitId;
  custom: true;
  createdAt: string;
  updatedAt: string;
  copiedFrom?: SplitId;
  /** Set on delete. Hidden from lists, still resolved for history and swaps. */
  deletedAt?: string;
}

export interface Recommendation {
  targetKg: Kg | null;
  targetReps: number[];
  reason: string;
  kind: 'first' | 'hold' | 'increase' | 'reps' | 'deload' | 'assist';
  /** Bodyweight moves: suggested assistance or added load, when history supports it. */
  assistKg?: Kg | null;
  addedKg?: Kg | null;
}

export interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
}

export interface PlannedExercise extends Prescription {
  /** Empty string when no catalogue exercise fits the slot. */
  exerciseId: string;
  slotId: string;
  role: 'anchor' | 'accessory';
  rec: Recommendation;
}

export interface PlannedSession {
  key: string;
  splitId: SplitId;
  sessionIndex: number;
  cycle: number;
  title: string;
  exercises: PlannedExercise[];
  createdAt: string;
  /** Bumped by Rebuild to rotate accessories; anchors never change. */
  variant?: number;
  /** Set when built after a long break; loads and sets are eased. */
  returnTier?: 1 | 2 | 3;
}

export interface RotationState {
  sessionIndex: number;
  cycle: number;
}
