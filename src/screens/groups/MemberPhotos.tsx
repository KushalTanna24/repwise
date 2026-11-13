import dayjs from 'dayjs';
import { Camera } from 'lucide-react';
import type { ProgressPhoto } from '@/domain/types';
import { Card, Empty } from '@/components/ui/card';

/** A member's progress photos, newest first, through the 5-minute links from member-photos. */
export function MemberPhotos({ photos, urls, loading, failed }: { photos: ProgressPhoto[]; urls?: Record<string, string>; loading: boolean; failed: boolean }) {
  if (!photos.length)
    return (
      <Card>
        <Empty icon={<Camera className="size-10" />} title="No photos yet" />
      </Card>
    );
  if (failed) return <p className="py-6 text-center text-subhead text-label-2">Couldn't load photos. Check your connection.</p>;
  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {sorted.map((p) => {
        const url = urls?.[p.path];
        return (
          <figure key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-fill">
            {url ? (
              <img src={url} alt={`Progress photo ${dayjs(p.date).format('D MMM YYYY')}`} className="size-full object-cover" />
            ) : (
              <div className={loading ? 'size-full animate-pulse' : 'grid size-full place-items-center p-1 text-center text-caption text-label-2'}>{loading ? null : 'Not available'}</div>
            )}
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/40 px-1.5 py-0.5 text-caption text-white">{dayjs(p.date).format('D MMM')}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
