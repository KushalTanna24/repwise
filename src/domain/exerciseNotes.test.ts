import { describe, expect, it } from 'vitest';
import { emptyAppData } from './catalogue';
import { addNoteLine, exerciseNoteLines, noteLines, setExerciseNote, updateNoteLine } from './exerciseNotes';
import { normalize } from './migrate';

describe('note lines', () => {
  const T = '2026-10-17T08:00:00.000Z';
  it('appends bullets per section, steps included', () => {
    let d = addNoteLine(emptyAppData(T), 'back-squat', 'think', 'Brace');
    d = addNoteLine(d, 'back-squat', 'think', '  Knees   out ');
    d = addNoteLine(d, 'back-squat', 'steps', 'Two warm-up sets');
    expect(d.exerciseNotes['back-squat']).toEqual({ think: 'Brace\nKnees out', steps: 'Two warm-up sets' });
    expect(addNoteLine(d, 'back-squat', 'think', '   ')).toBe(d);
  });

  it('edits one bullet and removes it when blank', () => {
    let d = addNoteLine(addNoteLine(emptyAppData(T), 'x', 'mistakes', 'A'), 'x', 'mistakes', 'B');
    d = updateNoteLine(d, 'x', 'mistakes', 0, 'A2');
    expect(exerciseNoteLines(d, 'x', 'mistakes')).toEqual(['A2', 'B']);
    d = updateNoteLine(d, 'x', 'mistakes', 1, '');
    expect(exerciseNoteLines(d, 'x', 'mistakes')).toEqual(['A2']);
    d = updateNoteLine(d, 'x', 'mistakes', 0, ' ');
    expect(d.exerciseNotes).toEqual({});
    expect(updateNoteLine(d, 'x', 'mistakes', 5, 'nope')).toBe(d);
  });
});

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
