import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, Ellipsis, Minus, Plus, Repeat, Sparkles, SkipForward, Target } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { exerciseHistory } from '@/domain/stats';
import { addSet, confirmSet, moveExercise, removeSet, skipExercise, skipSet, uncheckSet, updateSet } from '@/domain/session';
import type { AppData, Recommendation, SessionExercise } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { cn } from '@/lib/cn';
import { exName, fmtDay, fmtLoad, fmtRange } from '@/lib/fmt';
import { toast } from '@/lib/toast';
import { act, useApp } from '@/store/app';
import { SetRow } from './SetRow';
import { GuideButton } from '../Guide';
import { startRest } from './RestTimer';

const REC_STYLE: Record<Recommendation['kind'], { icon: typeof ArrowUp; cls: string }> = {
  increase: { icon: ArrowUpRight, cls: 'bg-green/12 text-[#248A3D]' },
  assist: { icon: ArrowUpRight, cls: 'bg-green/12 text-[#248A3D]' },
  reps: { icon: Target, cls: 'bg-blue/10 text-blue' },
  hold: { icon: Minus, cls: 'bg-fill text-label-2' },
  deload: { icon: ArrowDownRight, cls: 'bg-orange/15 text-[#C93400]' },
  first: { icon: Sparkles, cls: 'bg-purple/12 text-purple' },
};

interface Props {
  data: AppData;
  entry: SessionExercise;
  index: number;
  count: number;
  onSwap: () => void;
}

export function ExerciseCard({ data, entry, index, count, onSwap }: Props) {
  const ex = getExercise(entry.exerciseId, data.customExercises);
  const units = data.profile.units;
  const timed = ex?.kind === 'timed';
  const usesAssist = entry.sets.some((s) => s.assistKg !== undefined);
  const loadField = timed ? null : usesAssist ? 'assistKg' : 'actualKg';
  const last = ex ? exerciseHistory(data, ex.id).at(-1) : undefined;
  const anyDone = entry.sets.some((s) => s.status === 'done');
  const allDone = entry.sets.length > 0 && entry.sets.every((s) => s.status !== 'pending');
  const rec = entry.rec;
  const style = rec ? REC_STYLE[rec.kind] : null;

  if (!entry.exerciseId) {
    return (
      <Card className="p-4">
        <div className="text-headline font-semibold text-orange">No exercise fits this slot</div>
        <p className="mt-1 text-subhead text-label-2">Your equipment or exclusions rule out every option. Pick something else to fill it.</p>
        <Button variant="tinted" className="mt-3" onClick={onSwap}>
          Pick an exercise
        </Button>
      </Card>
    );
  }

  function toggle(setIdx: number): boolean {
    const set = entry.sets[setIdx];
    if (set.status === 'done') {
      act((d) => uncheckSet(d, index, setIdx));
      return true;
    }
    const before = useApp.getState().data;
    const after = confirmSet(before, index, setIdx);
    if (after === before) {
      toast('Enter the weight you used');
      return false;
    }
    act(() => after);
    const restSec = entry.plan?.restSec ?? 90;
    const finishedExercise = after.activeSession!.exercises[index].sets.every((s) => s.status !== 'pending');
    startRest(finishedExercise ? Math.min(restSec, 120) : restSec);
    return true;
  }

  const kgHeader = timed ? '' : usesAssist ? `Assist ${units}` : ex?.kind === 'bodyweight' ? `+${units}` : units;

  return (
    <Card className={cn('p-4 transition-opacity', entry.skipped && 'opacity-50')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-headline font-semibold">{exName(data, entry.exerciseId)}</h3>
            <GuideButton id={entry.exerciseId} className="-ml-1" />
            {allDone && !entry.skipped && <span className="rounded-full bg-green px-2 py-0.5 text-caption font-bold text-white">Done</span>}
          </div>
          <div className="text-footnote text-label-2">
            {ex?.muscle} · {entry.plan ? `${entry.plan.sets} × ${fmtRange(entry.plan.repMin, entry.plan.repMax, timed)}` : 'Extra'}
            {entry.plan && ` · rest ${Math.round(entry.plan.restSec / 60 * 2) / 2} min`}
          </div>
        </div>
        <Menu
          label={`${exName(data, entry.exerciseId)} options`}
          trigger={
            <Button variant="gray" size="icon" aria-label="Exercise options">
              <Ellipsis className="size-5" />
            </Button>
          }
          items={[
            { label: 'Swap exercise', icon: <Repeat className="size-4" />, onSelect: onSwap, disabled: anyDone },
            { label: 'Add set', icon: <Plus className="size-4" />, onSelect: () => act((d) => addSet(d, index)) },
            ...(ex?.kind === 'bodyweight'
              ? [
                  {
                    label: usesAssist ? 'Log added weight' : 'Log assistance',
                    icon: <ArrowDown className="size-4" />,
                    // assistKg present (even null) switches the load column to assistance.
                    onSelect: () =>
                      act((d) => entry.sets.reduce((x, _, i) => updateSet(x, index, i, { assistKg: usesAssist ? undefined : null }), d)),
                  },
                ]
              : []),
            { label: 'Move up', icon: <ArrowUp className="size-4" />, onSelect: () => act((d) => moveExercise(d, index, index - 1)), disabled: index === 0 },
            { label: 'Move down', icon: <ArrowDown className="size-4" />, onSelect: () => act((d) => moveExercise(d, index, index + 1)), disabled: index === count - 1 },
            { label: 'Skip exercise', icon: <SkipForward className="size-4" />, onSelect: () => act((d) => skipExercise(d, index)), destructive: true, disabled: entry.skipped },
          ]}
        />
      </div>

      {rec && style && (
        <div className={cn('mt-3 flex items-start gap-2 rounded-[12px] px-3 py-2 text-footnote font-medium', style.cls)}>
          <style.icon className="mt-[1px] size-4 shrink-0" strokeWidth={2.5} />
          <span>{rec.reason}</span>
        </div>
      )}
      {last && (
        <div className="mt-2 px-1 text-footnote text-label-2">
          Last · {timed ? '' : `${fmtLoad(last.bestKg, units)} × `}
          {last.sets.map((s) => s.actualReps).join(' · ')}
          {timed ? 's' : ''} · {fmtDay(last.date)}
        </div>
      )}

      <div className="mt-3 grid grid-cols-[36px_1fr_1fr_44px] gap-2 px-1 text-caption font-semibold uppercase tracking-wide text-label-2">
        <span className="text-center">Set</span>
        <span className="text-center">{kgHeader}</span>
        <span className="text-center">{timed ? 'Sec' : 'Reps'}</span>
        <span />
      </div>
      <div className="mt-1 grid gap-1">
        {entry.sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            set={s}
            ex={ex}
            units={units}
            loadField={loadField}
            targetAssist={rec?.assistKg ?? null}
            onPatch={(patch) => act((d) => updateSet(d, index, i, patch))}
            onToggle={() => toggle(i)}
            onSkip={() => act((d) => skipSet(d, index, i))}
            onRemove={() => act((d) => removeSet(d, index, i))}
          />
        ))}
      </div>
      <Button variant="plain" size="sm" className="mt-2" onClick={() => act((d) => addSet(d, index))}>
        <Plus className="size-4" strokeWidth={2.5} /> Add set
      </Button>
    </Card>
  );
}
