import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/sync/client';

const BUCKET = 'progress-photos';

/** Shrinks to at most `maxPx` on the long side and re-encodes as JPEG. */
export async function resizeToJpeg(file: Blob, maxPx = 1600, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/jpeg', quality));
}

/** Uploads to the user's own folder and returns the object path. */
export async function uploadPhoto(userId: string, photoId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${photoId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function deletePhotoObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/** A signed link valid for an hour, refreshed before it runs out. */
export function usePhotoUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['photo', path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
