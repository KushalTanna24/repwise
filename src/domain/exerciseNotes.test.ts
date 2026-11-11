import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { noteLines, setExerciseNote } from './exerciseNotes';
import { normalize } from './migrate';

const T0 = '2026-10-17T08:00:00.000Z';

describe('setExerciseNote', () => {
  it('stores each field on its own and trims it', () => {
    let d = setExerciseNote(emptyAppData(T0), 'back-squat', 'think', '  Brace before every rep \n');
    d = setExerciseNote(d, 'back-squat', 'mistakes', 'Heels lift');
    expect(d.exerciseNotes['back-squat']).toEqual({ think: 'Brace before every rep', mistakes: 'Heels lift' });
  });

  it('drops the entry once both fields are empty', () => {
    let d = setExerciseNote(emptyAppData(T0), 'back-squat', 'think', 'Brace');
    d = setExerciseNote(d, 'back-squat', 'think', '   ');
    expect(d.exerciseNotes).toEqual({});
  });

  it('returns the same object when nothing changes', () => {
    const d = setExerciseNote(emptyAppData(T0), 'back-squat', 'think', 'Brace');
    expect(setExerciseNote(d, 'back-squat', 'think', 'Brace ')).toBe(d);
    const empty = emptyAppData(T0);
    expect(setExerciseNote(empty, 'back-squat', 'mistakes', '')).toBe(empty);
  });
});

describe('noteLines', () => {
  it('splits on new lines and drops blanks and list markers', () => {
    expect(noteLines('- Brace\n\n• Knees out\n  Slow down  ')).toEqual(['Brace', 'Knees out', 'Slow down']);
    expect(noteLines(undefined)).toEqual([]);
  });
});

describe('normalize', () => {
  it('gives older documents an empty notes map', () => {
    const { exerciseNotes, ...old } = emptyAppData(T0);
    expect(exerciseNotes).toEqual({});
    expect(normalize(old, T0)!.exerciseNotes).toEqual({});
  });
});
