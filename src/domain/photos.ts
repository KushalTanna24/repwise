import type { AppData, ProgressPhoto } from './types';

export const addPhoto = (data: AppData, photo: ProgressPhoto): AppData => ({ ...data, photos: [...data.photos, photo] });

export function removePhoto(data: AppData, id: string): AppData {
  return data.photos.some((p) => p.id === id) ? { ...data, photos: data.photos.filter((p) => p.id !== id) } : data;
}

export const photoFor = (data: AppData, runId: string, date: string) => data.photos.find((p) => p.challengeId === runId && p.date === date);
