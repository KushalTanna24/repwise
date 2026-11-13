import type { NudgeDecision } from './decide.ts';

// Copies of src/domain/fasting.ts; decideFast.test.ts keeps them in step.
export const FAST_MILESTONES_H = [12, 24, 36];
export const FAST_PHASES: { fromH: number; label: string }[] = [
  { fromH: 0, label: 'Digesting' },
  { fromH: 4, label: 'Blood sugar settling' },
  { fromH: 12, label: 'Fat burning' },
  { fromH: 18, label: 'Ketosis' },
  { fromH: 24, label: 'Autophagy ramping up' },
];

const HOUR = 3_600_000;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Hourly cron: send when a milestone of the running fast fell in the last hour. */
export function decideFast(input: { now: Date; doc: unknown }): NudgeDecision {
  const fasts = isObj(input.doc) && Array.isArray(input.doc.fasts) ? input.doc.fasts : [];
  const fast = fasts.filter((f): f is Record<string, unknown> => isObj(f) && !f.endedAt).at(-1);
  const started = fast && typeof fast.startedAt === 'string' ? Date.parse(fast.startedAt) : NaN;
  const target = fast && typeof fast.targetHours === 'number' ? fast.targetHours : NaN;
  if (!Number.isFinite(started) || !Number.isFinite(target)) return { send: false, reason: 'no-data' };

  const now = input.now.getTime();
  const due = [...new Set([...FAST_MILESTONES_H, target])]
    .sort((a, b) => a - b)
    .filter((m) => started + m * HOUR > now - HOUR && started + m * HOUR <= now)
    .at(-1);
  if (due === undefined) return { send: false, reason: 'window' };
  if (due === target) return { send: true, title: 'Fast complete', body: `${target} hours done. Your fast hit its target.`, url: '/#/today', topic: 'fast' };
  const phase = FAST_PHASES.filter((p) => due >= p.fromH).at(-1)!.label;
  return { send: true, title: `${due} hours in`, body: `${phase}.`, url: '/#/today', topic: 'fast' };
}
