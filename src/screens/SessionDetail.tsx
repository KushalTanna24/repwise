import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Check, Minus, X } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { deleteHistorySession, editHistorySet } from '@/domain/session';
import { fromDisplay, sessionVolume, toDisplay } from '@/domain/stats';
import type { AppData, SetRecord, WorkoutSession } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, Empty } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { exName, fmtDuration, fmtLoad } from '@/lib/fmt';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';
import { NumberCell } from './workout/SetRow';

export function SessionSheet({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const data = useData();
  const [editing, setEditing] = useState(false);
  const s = sessionId ? data.sessions.find((x) => x.id === sessionId) : undefined;

  useEffect(() => setEditing(false), [sessionId]);

  async function remove() {
    if (!s) return;
    const ok = await confirm({
      title: 'Delete this workout?',
      message: 'It disappears from history and progress charts. Your rotation is not changed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    act((d) => deleteHistorySession(d, s.id));
    toast('Workout deleted');
    onClose();
  }

  return (
    <Sheet
      open={!!sessionId}
      onClose={onClose}
      title={s?.title ?? 'Workout'}
      left={<Button variant="plain" size="sm" className="-ml-2" onClick={onClose}>Close</Button>}
      right={s && <Button variant="plain" size="sm" className="font-bold" onClick={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit'}</Button>}
    >
      {!s ? (
        <Empty title="Workout not found" body="It may have been deleted." />
      ) : (
        <Detail data={data} s={s} editing={editing} onDelete={remove} />
      )}
    </Sheet>
  );
}

function Detail({ data, s, editing, onDelete }: { data: AppData; s: WorkoutSession; editing: boolean; onDelete: () => void }) {
  const v = sessionVolume(s);
  const units = data.profile.units;
  return (
    <div className="grid gap-3 pb-4">
      <Card className="grid grid-cols-3 divide-x divide-sep py-3 text-center">
        <div>
          <div className="text-footnote text-label-2">{dayjs(s.startedAt).format('ddd')}</div>
          <div className="text-headline font-semibold">{dayjs(s.startedAt).format('D MMM')}</div>
        </div>
        <div>
          <div className="text-footnote text-label-2">Time</div>
          <div className="text-headline font-semibold">{s.finishedAt ? fmtDuration(Date.parse(s.finishedAt) - Date.parse(s.startedAt)) : '—'}</div>
        </div>
        <div>
          <div className="text-footnote text-label-2">Sets</div>
          <div className="text-headline font-semibold">{v.sets}</div>
        </div>
      </Card>
      {editing && <p className="px-1 text-footnote text-label-2">Fix what you actually lifted. Editing history never changes your split rotation.</p>}

      {s.exercises.map((e, ei) => {
        const timed = getExercise(e.exerciseId, data.customExercises)?.kind === 'timed';
        return (
          <Card key={`${e.exerciseId}-${ei}`} className="p-4">
            <div className="text-headline font-semibold">{exName(data, e.exerciseId)}</div>
            {e.rec && <div className="mt-0.5 text-footnote text-label-2">{e.rec.reason}</div>}
            <div className="mt-3 grid grid-cols-[28px_1fr_1fr_28px] gap-2 text-caption font-semibold uppercase tracking-wide text-label-2">
              <span className="text-center">#</span>
              <span>Target</span>
              <span>Actual</span>
              <span />
            </div>
            {e.sets.map((x, si) => (
              <div key={si} className="grid grid-cols-[28px_1fr_1fr_28px] items-center gap-2 border-t border-sep py-2 first-of-type:border-0">
                <span className="text-center text-subhead font-bold tabular text-label-2">{si + 1}</span>
                <span className="text-subhead tabular text-label-2">{fmtSet(x.targetKg, x.targetReps, units, timed) ?? '—'}</span>
                {editing && x.status === 'done' ? (
                  <div className="grid grid-cols-2 gap-1">
                    {!timed && (
                      <NumberCell
                        label={`Set ${si + 1} load`}
                        value={x.actualKg == null ? null : toDisplay(x.actualKg, units)}
                        placeholder={units}
                        onCommit={(n) => act((d) => editHistorySet(d, s.id, ei, si, { actualKg: n == null ? null : fromDisplay(n, units) }))}
                      />
                    )}
                    <NumberCell
                      label={`Set ${si + 1} reps`}
                      value={x.actualReps}
                      placeholder="reps"
                      onCommit={(n) => n != null && act((d) => editHistorySet(d, s.id, ei, si, { actualReps: Math.round(n) }))}
                    />
                  </div>
                ) : (
                  <span className={cn('text-subhead font-semibold tabular', x.status !== 'done' && 'font-normal text-label-3')}>
                    {x.status === 'done' ? fmtSet(x.actualKg, x.actualReps, units, timed) : 'Not done'}
                  </span>
                )}
                <StatusIcon status={x.status} />
              </div>
            ))}
          </Card>
        );
      })}
      <Button variant="destructive" size="lg" className="mt-2" onClick={onDelete}>
        Delete workout
      </Button>
    </div>
  );
}

function fmtSet(kg: number | null, reps: number | null, units: 'kg' | 'lb', timed: boolean) {
  if (reps == null) return kg != null ? fmtLoad(kg, units) : null;
  if (timed) return `${reps}s`;
  return kg ? `${fmtLoad(kg, units)} × ${reps}` : `${reps} reps`;
}

function StatusIcon({ status }: { status: SetRecord['status'] }) {
  if (status === 'done') return <Check className="size-4 justify-self-center text-green" strokeWidth={3} />;
  if (status === 'skipped') return <X className="size-4 justify-self-center text-label-3" strokeWidth={3} />;
  return <Minus className="size-4 justify-self-center text-label-3" />;
}
