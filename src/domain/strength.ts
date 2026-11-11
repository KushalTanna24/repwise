import dayjs from 'dayjs';
import { getExercise } from './catalogue';
import { localDate } from './stats';
import type { AppData, Exercise, SetRecord } from './types';

/**
 * One comparable number for a set. Weighted lifts use the Epley estimated one-rep max;
 * bodyweight moves count reps, with every 2.5 kg added worth one rep; holds count seconds.
 */
export function setScore(kind: Exercise['kind'], s: SetRecord): number {
  const reps = s.actualReps ?? 0;
  const kg = s.actualKg ?? 0;
  if (kind === 'weighted') return kg > 0 ? kg * (1 + reps / 30) : 0;
  if (kind === 'bodyweight') return reps + Math.max(0, kg) / 2.5;
  return reps;
}

export interface LiftTrend {
  exerciseId: string;
  sessions: number;
  first: number;
  latest: number;
  /** Latest against first, e.g. 0.12 for 12% stronger. */
  change: number;
}

export interface OverallStrength {
  /** Monday of each trained week; index 100 means every lift at its starting level. */
  points: { date: string; index: number; lifts: number }[];
  /** Mean change across lifts done at least twice; null until one lift has two sessions. */
  change: number | null;
  lifts: LiftTrend[];
  /** Total kg moved per trained week, for the volume view. */
  volume: { date: string; kg: number }[];
}

const monday = (date: string) => {
  const d = dayjs(date);
  return d.subtract((d.day() + 6) % 7, 'day').format('YYYY-MM-DD');
};

/** Every lift measured against its own first session, so a beginner squat and a pull-up count the same. */
export function overallStrength(data: AppData): OverallStrength {
  const sessions = data.sessions.filter((s) => s.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const perLift = new Map<string, { date: string; score: number }[]>();
  const volume = new Map<string, number>();

  for (const s of sessions) {
    const date = localDate(s.startedAt);
    for (const e of s.exercises) {
      const ex = getExercise(e.exerciseId, data.customExercises);
      if (!ex) continue;
      const done = e.sets.filter((x) => x.status === 'done' && x.actualReps != null);
      if (!done.length) continue;
      const score = Math.max(...done.map((x) => setScore(ex.kind, x)));
      if (score > 0) perLift.set(ex.id, [...(perLift.get(ex.id) ?? []), { date, score }]);
      const kg = done.reduce((n, x) => n + (x.actualKg ?? 0) * (x.actualReps ?? 0), 0);
      volume.set(monday(date), (volume.get(monday(date)) ?? 0) + kg);
    }
  }

  const lifts: LiftTrend[] = [];
  const weeks = new Map<string, Map<string, number>>();
  for (const [exerciseId, hist] of perLift) {
    const first = hist[0].score;
    const latest = hist.at(-1)!.score;
    lifts.push({ exerciseId, sessions: hist.length, first, latest, change: latest / first - 1 });
    for (const h of hist) {
      const w = monday(h.date);
      const ratio = h.score / first;
      const byLift = weeks.get(w) ?? new Map<string, number>();
      byLift.set(exerciseId, Math.max(byLift.get(exerciseId) ?? 0, ratio));
      weeks.set(w, byLift);
    }
  }

  const points = [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, byLift]) => {
      const ratios = [...byLift.values()];
      return { date, index: (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100, lifts: ratios.length };
    });
  const repeated = lifts.filter((l) => l.sessions > 1);
  lifts.sort((a, b) => b.change - a.change || b.sessions - a.sessions);
  return {
    points,
    change: repeated.length ? repeated.reduce((n, l) => n + l.change, 0) / repeated.length : null,
    lifts,
    volume: [...volume.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, kg]) => ({ date, kg })),
  };
}
