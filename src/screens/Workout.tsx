import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { findSlot, swapCandidates } from '@/domain/planner';
import { addExercise, discardSession, finishSession, swapExercise } from '@/domain/session';
import { sessionPRs } from '@/domain/stats';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { fmtClock, nowIso } from '@/lib/fmt';
import { toast } from '@/lib/toast';
import { act, useApp, useData } from '@/store/app';
import { ExerciseCard } from './workout/ExerciseCard';
import { ExercisePicker } from './workout/ExercisePicker';
import { FinishSummary, type Summary } from './workout/FinishSummary';
import { RestTimer, useRest } from './workout/RestTimer';

type Mode = { kind: 'log' } | { kind: 'swap'; index: number } | { kind: 'add' };

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-subhead font-semibold tabular text-label-2">{fmtClock(now - Date.parse(since))}</span>;
}

export function WorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const s = data.activeSession;
  const [mode, setMode] = useState<Mode>({ kind: 'log' });
  const [summary, setSummary] = useState<Summary | null>(null);
  const finishing = useRef(false);

  // Android back closes the sheet through the router, not through close().
  useEffect(() => {
    if (!open) {
      setMode({ kind: 'log' });
      setSummary(null);
    }
  }, [open]);

  const doneCount = s?.exercises.reduce((n, e) => n + e.sets.filter((x) => x.status === 'done').length, 0) ?? 0;
  const pendingCount = s?.exercises.reduce((n, e) => n + e.sets.filter((x) => x.status === 'pending').length, 0) ?? 0;

  function close() {
    setMode({ kind: 'log' });
    setSummary(null);
    onClose();
  }

  async function finish() {
    if (finishing.current || !s) return;
    finishing.current = true;
    try {
      if (pendingCount > 0) {
        const ok = await confirm({
          title: 'Finish workout?',
          message: `${pendingCount} set${pendingCount === 1 ? '' : 's'} not ticked. They'll be saved as skipped and won't count toward progression.`,
          confirmLabel: 'Finish',
        });
        if (!ok) return;
      }
      const now = nowIso();
      const before = useApp.getState().data;
      const after = finishSession(before, now);
      const saved = after.sessions.find((x) => x.id === before.activeSession?.id);
      if (after === before || !saved) return;
      act(() => after);
      useRest.setState({ endsAt: null, total: 0 });
      setSummary({ session: saved, prs: sessionPRs(after, saved), next: useApp.getState().data.plannedSession?.title ?? null });
    } finally {
      finishing.current = false;
    }
  }

  async function discard() {
    const ok = await confirm({
      title: 'Discard workout?',
      message: "Nothing from this session is saved and your rotation stays where it is.",
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (!ok) return;
    act(discardSession);
    useRest.setState({ endsAt: null, total: 0 });
    toast('Workout discarded');
    close();
  }

  function pick(id: string) {
    if (mode.kind === 'swap') act((d) => swapExercise(d, mode.index, id));
    if (mode.kind === 'add') act((d) => addExercise(d, id));
    setMode({ kind: 'log' });
  }

  const picking = mode.kind !== 'log';
  const swapEntry = mode.kind === 'swap' ? s?.exercises[mode.index] : undefined;
  const swapSlot = swapEntry ? findSlot(s!.splitId, swapEntry.slotId) : undefined;

  const title = summary ? '' : picking ? (mode.kind === 'swap' ? 'Swap exercise' : 'Add exercise') : (s?.title ?? 'Workout');
  const left = summary ? null : picking ? (
    <Button variant="plain" size="sm" className="-ml-2" onClick={() => setMode({ kind: 'log' })}>
      <ChevronLeft className="size-5" /> Back
    </Button>
  ) : s ? (
    <Elapsed since={s.startedAt} />
  ) : null;
  const right =
    summary || picking || !s ? null : (
      <Button size="sm" variant="success" onClick={finish} disabled={doneCount === 0}>
        Finish
      </Button>
    );

  return (
    <Sheet open={open} onClose={close} tall title={title} left={left} right={right}>
      {summary ? (
        <FinishSummary data={data} summary={summary} onDone={close} />
      ) : !s ? (
        <Empty title="No workout in progress" body="Start one from Today." action={<Button onClick={close}>Close</Button>} />
      ) : picking ? (
        <ExercisePicker data={data} suggested={swapSlot ? swapCandidates(swapSlot, data).filter((e) => e.id !== swapEntry?.exerciseId) : []} onPick={pick} />
      ) : (
        <div className="grid gap-3 pt-1">
          {s.exercises.map((e, i) => (
            <ExerciseCard key={`${e.slotId ?? 'x'}-${i}-${e.exerciseId}`} data={data} entry={e} index={i} count={s.exercises.length} onSwap={() => setMode({ kind: 'swap', index: i })} />
          ))}
          <Button variant="tinted" size="lg" onClick={() => setMode({ kind: 'add' })}>
            <Plus className="size-5" strokeWidth={2.5} /> Add exercise
          </Button>
          <Button variant="plain" className="mx-auto text-red" onClick={discard}>
            Discard workout
          </Button>
          <RestTimer />
        </div>
      )}
    </Sheet>
  );
}
