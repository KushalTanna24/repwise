import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { addCustomExercise, renameCustomExercise, setArchived, setExcluded } from './library';

const NOW = '2026-10-17T08:00:00.000Z';
const base = { muscle: 'Back', pattern: 'hpull', equipment: 'cable', kind: 'weighted' } as const;

describe('library', () => {
  it('adds a custom exercise with a stable unique slug id', () => {
    let d = addCustomExercise(emptyAppData(NOW), { ...base, name: 'Ring Rows' });
    d = addCustomExercise(d, { ...base, name: 'ring rows' });
    expect(d.customExercises.map((e) => e.id)).toEqual(['custom-ring-rows', 'custom-ring-rows-2']);
    expect(d.customExercises[0]).toMatchObject({ name: 'Ring Rows', custom: true });
  });

  it('ignores blank names', () => {
    const d = emptyAppData(NOW);
    expect(addCustomExercise(d, { ...base, name: '  ' })).toBe(d);
  });

  it('rename keeps the id', () => {
    let d = addCustomExercise(emptyAppData(NOW), { ...base, name: 'Ring rows' });
    d = renameCustomExercise(d, 'custom-ring-rows', 'Gymnastic ring rows');
    expect(d.customExercises[0]).toMatchObject({ id: 'custom-ring-rows', name: 'Gymnastic ring rows' });
  });

  it('archive and exclude toggle membership without duplicates', () => {
    let d = setArchived(emptyAppData(NOW), 'x', true);
    d = setArchived(d, 'x', true);
    expect(d.archivedExerciseIds).toEqual(['x']);
    expect(setArchived(d, 'x', false).archivedExerciseIds).toEqual([]);
    d = setExcluded(d, 'dip', true);
    expect(d.profile.excludedExerciseIds).toEqual(['dip']);
    expect(d.plannedSession).toBeNull();
  });
});
