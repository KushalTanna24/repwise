import { usePhotoUrl } from '@/lib/photos';
import { cn } from '@/lib/cn';
import { useDoc } from '@/store/docContext';

/** A stored progress photo through a short-lived signed link; grey while loading. */
export function PhotoThumb({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const { readOnly, photoUrls } = useDoc();
  // Someone else's photo can't be signed with your own access; the member view supplies its links.
  const own = usePhotoUrl(readOnly ? undefined : path);
  const url = readOnly ? photoUrls?.[path] : own.data;
  if (!readOnly && own.isError)
    return <div className={cn('grid place-items-center bg-fill p-1 text-center text-caption text-label-2', className)}>Couldn't load photo</div>;
  if (readOnly && photoUrls && !url)
    return <div className={cn('grid place-items-center bg-fill p-1 text-center text-caption text-label-2', className)}>Photo not available</div>;
  if (!url) return <div className={cn('animate-pulse bg-fill', className)} aria-label="Loading photo" />;
  return <img src={url} alt={alt} className={cn('object-cover', className)} />;
}
