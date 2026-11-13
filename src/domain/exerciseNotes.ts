import type { AppData, ExerciseNote } from './types';

export type NoteField = keyof ExerciseNote;

const FIELDS: NoteField[] = ['steps', 'think', 'mistakes'];

/** Save one of the user's own notes for an exercise. Empty text clears it. */
export function setExerciseNote(data: AppData, exerciseId: string, field: NoteField, text: string): AppData {
  const current = data.exerciseNotes[exerciseId] ?? {};
  const value = text.trim();
  if ((current[field] ?? '') === value) return data;
  const next: ExerciseNote = { ...current };
  if (value) next[field] = value;
  else delete next[field];
  const notes = { ...data.exerciseNotes };
  if (FIELDS.some((f) => next[f])) notes[exerciseId] = next;
  else delete notes[exerciseId];
  return { ...data, exerciseNotes: notes };
}

/** One reminder per line; tolerates pasted "- " and "• " bullets. */
export function noteLines(text: string | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/** The user's lines for one section of an exercise. */
export const exerciseNoteLines = (data: AppData, exerciseId: string, field: NoteField) => noteLines(data.exerciseNotes[exerciseId]?.[field]);

/** Append one bullet to a section. Blank text is ignored. */
export function addNoteLine(data: AppData, exerciseId: string, field: NoteField, text: string): AppData {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return data;
  return setExerciseNote(data, exerciseId, field, [...exerciseNoteLines(data, exerciseId, field), line].join('\n'));
}

/** Rewrite one bullet; blank text removes it. */
export function updateNoteLine(data: AppData, exerciseId: string, field: NoteField, index: number, text: string): AppData {
  const lines = exerciseNoteLines(data, exerciseId, field);
  if (index < 0 || index >= lines.length) return data;
  const line = text.replace(/\s+/g, ' ').trim();
  const next = line ? lines.map((l, i) => (i === index ? line : l)) : lines.filter((_, i) => i !== index);
  return setExerciseNote(data, exerciseId, field, next.join('\n'));
}
