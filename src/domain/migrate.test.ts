import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import v2 from './fixtures/v2.json';
import { isEmpty, migrateV2, normalize, parseImport } from './migrate';

const NOW = '2026-10-17T08:00:00.000Z';

describe('migrateV2', () => {
  const d = migrateV2(v2, NOW);

  it('maps known names to catalogue ids and unknown ones to custom exercises', () => {
    expect(d.sessions[0].exercises.map((e) => e.exerciseId)).toEqual(['incline-db-press', 'custom-ring-rows']);
    expect(d.customExercises.map((e) => e.id)).toEqual(['custom-ring-rows']);
    expect(d.sessions[1].exercises[0].exerciseId).toBe('pull-up');
  });

  it('turns old sets into done sets with actuals and no target', () => {
    expect(d.sessions[0].exercises[0].sets).toEqual([
      { targetKg: null, targetReps: null, actualKg: 20, actualReps: 10, status: 'done' },
      { targetKg: null, targetReps: null, actualKg: 20, actualReps: 9, status: 'done' },
    ]);
    expect(d.sessions[0]).toMatchObject({ id: '11111111-1111-1111-1111-111111111111', planKey: null, splitId: null, title: 'Full Body' });
    expect(d.sessions[0].finishedAt).not.toBeNull();
  });

  it('keeps weigh-ins and marks the migration', () => {
    expect(d.bodyweights.map((w) => [w.date, w.kg])).toEqual([
      ['2026-09-01', 61.2],
      ['2026-09-08', 60.8],
    ]);
    expect(d.meta.migratedFrom).toBe('repwise_v2');
    expect(d.program.splitId).toBeNull();
  });

  it('is deterministic', () => {
    expect(migrateV2(v2, NOW)).toEqual(d);
  });

  it('carries the legacy exclusion when it maps to an exercise', () => {
    expect(d.profile.excludedExerciseIds).toEqual(['dip']);
  });
});

describe('normalize and parseImport', () => {
  it('accepts v4, legacy export wrapper and raw v2', () => {
    const v4 = emptyAppData(NOW);
    expect(normalize(v4, NOW)).toEqual(v4);
    expect(normalize({ version: 3, state: v2 }, NOW)?.sessions).toHaveLength(2);
    expect(normalize(v2, NOW)?.sessions).toHaveLength(2);
    expect(normalize({ foo: 1 }, NOW)).toBeNull();
    expect(normalize(null, NOW)).toBeNull();
  });

  it('rejects junk with a readable error', () => {
    expect(parseImport('{"foo":1}', NOW)).toEqual({ ok: false, error: "This file isn't a Repwise backup." });
    expect(parseImport('not json', NOW)).toEqual({ ok: false, error: "This file isn't valid JSON." });
    expect(parseImport('{"schemaVersion":9}', NOW)).toEqual({ ok: false, error: 'This backup is from a newer version of Repwise.' });
  });

  it('summarises a valid import', () => {
    const r = parseImport(JSON.stringify({ version: 3, state: v2 }), NOW);
    expect(r.ok && r.summary).toEqual({ sessions: 2, bodyweights: 2, from: '2026-09-01', to: '2026-09-08' });
  });

  it('round-trips a v4 export', () => {
    const d = migrateV2(v2, NOW);
    const r = parseImport(JSON.stringify(d), NOW);
    expect(r.ok && r.data).toEqual(d);
  });

  it('isEmpty only when there is no training or body data', () => {
    expect(isEmpty(emptyAppData(NOW))).toBe(true);
    expect(isEmpty(migrateV2(v2, NOW))).toBe(false);
  });
});
