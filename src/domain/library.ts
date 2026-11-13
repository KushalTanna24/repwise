import { getExercise } from './catalogue';
import type { AppData, Exercise } from './types';

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const toggle = (list: string[], id: string, on: boolean) => (on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id));

export function addCustomExercise(data: AppData, input: Omit<Exercise, 'id' | 'custom'>): AppData {
  const name = input.name.trim();
  if (!name) return data;
  const root = `custom-${slug(name)}`;
  let id = root;
  for (let n = 2; getExercise(id, data.customExercises); n++) id = `${root}-${n}`;
  return { ...data, customExercises: [...data.customExercises, { ...input, name, id, custom: true }] };
}

/** Names are labels; the id (and so the history) never changes. */
export function renameCustomExercise(data: AppData, id: string, name: string): AppData {
  if (!name.trim()) return data;
  return { ...data, customExercises: data.customExercises.map((e) => (e.id === id ? { ...e, name: name.trim() } : e)) };
}

/** Archived exercises leave the planner and pickers; their history stays. */
export function setArchived(data: AppData, id: string, archived: boolean): AppData {
  return { ...data, archivedExerciseIds: toggle(data.archivedExerciseIds, id, archived), plannedSession: null };
}

export function setExcluded(data: AppData, id: string, excluded: boolean): AppData {
  return { ...data, profile: { ...data.profile, excludedExerciseIds: toggle(data.profile.excludedExerciseIds, id, excluded) }, plannedSession: null };
}
