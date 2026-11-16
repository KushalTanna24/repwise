import { useState } from 'react';
import dayjs from 'dayjs';
import { X } from 'lucide-react';
import { removePhoto } from '@/domain/photos';
import type { AppData, ChallengeRun, ProgressPhoto } from '@/domain/types';
import { PhotoThumb } from '@/components/PhotoThumb';
import { SectionHeader } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { deletePhotoObject } from '@/lib/photos';
import { toast } from '@/lib/toast';
import { act } from '@/store/app';

/** The run's photos by day, plus a first-vs-latest slider. */
export function PhotoTimeline({ data, run }: { data: AppData; run: ChallengeRun }) {
  const photos = data.photos.filter((p) => p.challengeId === run.id).sort((a, b) => a.date.localeCompare(b.date));
  if (!photos.length) return null;

  async function remove(p: ProgressPhoto) {
    const ok = await confirm({ title: 'Delete this photo?', message: 'It is removed from your storage too.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await deletePhotoObject(p.path);
      act((d) => removePhoto(d, p.id));
      toast('Photo deleted');
    } catch {
      toast("Couldn't delete. Check your connection");
    }
  }

  return (
    <>
      {photos.length >= 2 && <BeforeAfter first={photos[0]} latest={photos.at(-1)!} />}
      <SectionHeader title="Photos" />
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p) => (
          <figure key={p.id} className="relative overflow-hidden rounded-[10px]">
            <PhotoThumb path={p.path} alt={`Progress photo ${dayjs(p.date).format('D MMM')}`} className="aspect-[3/4] w-full" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-0.5 text-caption text-white">{dayjs(p.date).format('D MMM')}</figcaption>
            <button aria-label={`Delete photo from ${dayjs(p.date).format('D MMM')}`} onClick={() => void remove(p)} className="press absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/45 text-white">
              <X className="size-4" />
            </button>
          </figure>
        ))}
      </div>
    </>
  );
}

function BeforeAfter({ first, latest }: { first: ProgressPhoto; latest: ProgressPhoto }) {
  const [split, setSplit] = useState(50);
  return (
    <>
      <SectionHeader title={`${dayjs(first.date).format('D MMM')} vs ${dayjs(latest.date).format('D MMM')}`} />
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card">
        <PhotoThumb path={latest.path} alt="Latest photo" className="absolute inset-0 size-full" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          <PhotoThumb path={first.path} alt="First photo" className="size-full" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
      </div>
      <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Compare first and latest" className="mt-2 w-full accent-[#FF9500]" />
    </>
  );
}
