import { useRef, useState } from 'react';
import { Camera, Check, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { dayNumber, taskDone, toggleTask } from '@/domain/challenges';
import { addPhoto, photoFor, removePhoto } from '@/domain/photos';
import { PhotoThumb } from '@/components/PhotoThumb';
import { deletePhotoObject, resizeToJpeg, uploadPhoto } from '@/lib/photos';
import { useSyncState } from '@/sync/useSync';
import type { AppData, ChallengeRun, ChallengeTask } from '@/domain/types';
import { Card, List, Row } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { openSheet } from '@/lib/route';
import { act } from '@/store/app';

const AUTO_NOTE: Record<NonNullable<ChallengeTask['auto']>, string> = {
  workout: 'from your workout',
  'workout-outdoor': 'from a logged run',
  water: 'from water',
};
const EVENING = 20 * 60;

/** Today's tasks for one run; auto tasks follow your logs. */
export function ChallengeCard({ data, run, today, nowMinutes }: { data: AppData; run: ChallengeRun; today: string; nowMinutes: number }) {
  const upcoming = run.startDate > today;
  const n = dayNumber(run, today);
  const open = run.tasks.filter((t) => !taskDone(data, run, t, today)).length;

  return (
    <Card className="mt-4 overflow-hidden">
      <button onClick={() => openSheet(`challenge:${run.id}`)} className="flex w-full items-start gap-3 px-4 pt-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="text-footnote font-semibold uppercase tracking-wide text-orange">{upcoming ? 'Starts tomorrow' : `Day ${n} of ${run.days}`}</div>
          <div className="truncate text-title3 font-bold">{run.title}</div>
        </div>
        {!upcoming && run.rule === 'strict' && open > 0 && nowMinutes >= EVENING && (
          <span className="shrink-0 rounded-full bg-orange/15 px-2 py-1 text-footnote font-semibold text-[#C93400]">
            {open} {open === 1 ? 'task' : 'tasks'} left today
          </span>
        )}
        <ChevronRight className="mt-1 size-5 shrink-0 text-label-3" />
      </button>
      {!upcoming && (
        <>
          <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
            <div className="h-full rounded-full bg-orange" style={{ width: `${Math.min(100, (n / run.days) * 100)}%` }} />
          </div>
          <div className="mt-2 pb-1">
            {run.tasks.map((t) => (
              <TaskRow key={t.id} data={data} run={run} task={t} today={today} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Tick({ done, busy }: { done: boolean; busy?: boolean }) {
  return (
    <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', done ? 'border-green bg-green text-white' : 'border-label-3')}>
      {busy ? <Loader2 className="size-4 animate-spin text-label-2" /> : done && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

function TaskRow({ data, run, task, today }: { data: AppData; run: ChallengeRun; task: ChallengeTask; today: string }) {
  const user = useSyncState((s) => s.user);
  const done = taskDone(data, run, task, today);
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const photo = task.kind === 'photo' ? photoFor(data, run.id, today) : undefined;
  const row = 'flex min-h-11 w-full items-center gap-3 px-4 py-1.5 text-left';

  // Signed out, a photo task is a plain tick; the photo needs somewhere private to live.
  if (task.kind !== 'photo' || !user || (done && !photo)) {
    return (
      <button role="checkbox" aria-checked={done} aria-label={task.label} disabled={!!task.auto} onClick={() => act((d) => toggleTask(d, run.id, task.id, today, today))} className={row}>
        <Tick done={done} />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-body', done && 'text-label-2')}>{task.label}</span>
          {task.kind === 'photo' && !user && <span className="block text-footnote text-label-2">Sign in to save photos</span>}
        </span>
        {task.auto && <span className="shrink-0 text-footnote text-label-2">{AUTO_NOTE[task.auto]}</span>}
      </button>
    );
  }

  async function pick(file: File | undefined) {
    if (!file || !user) return;
    setState('busy');
    try {
      const id = crypto.randomUUID();
      const path = await uploadPhoto(user.id, id, await resizeToJpeg(file));
      // A retake replaces the day's photo.
      act((d) => addPhoto(photo ? removePhoto(d, photo.id) : d, { id, date: today, path, challengeId: run.id }));
      if (photo) void deletePhotoObject(photo.path).catch(() => {});
      setState('idle');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className={row}>
      <Tick done={done} busy={state === 'busy'} />
      <button className="min-w-0 flex-1 text-left" disabled={state === 'busy'} onClick={() => input.current?.click()} aria-label={`${task.label}: ${photo ? 'retake' : 'take'} photo`}>
        <span className={cn('block text-body', done && 'text-label-2')}>{task.label}</span>
        {state === 'failed' && <span className="block text-footnote text-red">Upload failed. Retry</span>}
      </button>
      {photo ? (
        <PhotoThumb path={photo.path} alt="Today's photo" className="size-10 shrink-0 rounded-[8px]" />
      ) : (
        <Camera className="size-5 shrink-0 text-blue" />
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

/** Shown on Today when no challenge is running. */
export function AddChallengeRow() {
  return (
    <List className="mt-4">
      <Row leading={<Trophy className="size-5 shrink-0 text-orange" />} title="Add a challenge" subtitle="75-Day, habit stack, your own, or a fast" onClick={() => openSheet('challenges')} chevron />
    </List>
  );
}
