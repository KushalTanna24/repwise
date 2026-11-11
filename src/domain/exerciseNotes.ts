import type { AppData, ExerciseNote } from './types';

export type NoteField = keyof ExerciseNote;

/** Save one of the user's own notes for an exercise. Empty text clears it. */
export function setExerciseNote(data: AppData, exerciseId: string, field: NoteField, text: string): AppData {
  const current = data.exerciseNotes[exerciseId] ?? {};
  const value = text.trim();
  if ((current[field] ?? '') === value) return data;
  const next: ExerciseNote = { ...current };
  if (value) next[field] = value;
  else delete next[field];
  const notes = { ...data.exerciseNotes };
  if (next.think || next.mistakes) notes[exerciseId] = next;
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
