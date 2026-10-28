import { usePhotoUrl } from '@/lib/photos';
import { cn } from '@/lib/cn';

/** A stored progress photo through a short-lived signed link; grey while loading. */
export function PhotoThumb({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const url = usePhotoUrl(path);
  if (url.isError)
    return <div className={cn('grid place-items-center bg-fill p-1 text-center text-caption text-label-2', className)}>Couldn't load photo</div>;
  if (!url.data) return <div className={cn('animate-pulse bg-fill', className)} aria-label="Loading photo" />;
  return <img src={url.data} alt={alt} className={cn('object-cover', className)} />;
}
