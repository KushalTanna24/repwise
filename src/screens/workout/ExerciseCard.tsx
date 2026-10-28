import { useEffect, useState } from 'react';
import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, ChevronDown, Ellipsis, Minus, Plus, Repeat, Sparkles, SkipForward, Target } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getExercise } from '@/domain/catalogue';
import { lastDoneMs, region, suggestNext } from '@/domain/flow';
import { exerciseHistory } from '@/domain/stats';
import { addSet, confirmSet, moveExercise, removeSet, skipExercise, skipSet, uncheckSet, updateSet } from '@/domain/session';
import type { AppData, Recommendation, SessionExercise, SetRecord } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { cn } from '@/lib/cn';
import { exName, fmtClock, fmtDay, fmtLoad, fmtRange, nowIso } from '@/lib/fmt';
import { toast } from '@/lib/toast';
import { act, useApp } from '@/store/app';
import { SetRow } from './SetRow';
import { useHighlight } from './highlight';
import { GuideButton } from '../Guide';
import { startRest } from './RestTimer';
import { useDoneCollapse } from '../today/DoneRow';

/** Rest when the next suggested set is a different body area. */
const SWITCH_REST_SEC = 45;

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
  const highlight = useHighlight((s) => s.key);
  const reduce = useReducedMotion();
  // A finished or skipped exercise folds to one line so the open ones stay in reach.
  const finished = allDone || !!entry.skipped;
  const [collapsed, expand, fold] = useDoneCollapse(finished);

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
    const now = nowIso();
    const after = confirmSet(before, index, setIdx, now);
    if (after === before) {
      toast('Enter the weight you used');
      return false;
    }
    act(() => after);
    // Freestyle: switching body area only needs a short breather; repeating this exercise needs its full rest.
    const session = after.activeSession!;
    const next = suggestNext(session, after.customExercises, now);
    if (next) {
      const nextEx = getExercise(session.exercises[next.exIdx].exerciseId, after.customExercises);
      const switching = next.exIdx !== index && !!ex && !!nextEx && region(nextEx.pattern) !== region(ex.pattern);
      startRest(switching ? SWITCH_REST_SEC : (entry.plan?.restSec ?? 90));
    }
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
            {!allDone && !entry.skipped && <Recovery last={lastDoneMs(entry.sets)} restSec={entry.plan?.restSec ?? 90} />}
            {allDone && !entry.skipped && <span className="rounded-full bg-green px-2 py-0.5 text-caption font-bold text-white">Done</span>}
          </div>
          {collapsed ? (
            <button onClick={expand} aria-expanded={false} aria-label={`Show sets for ${exName(data, entry.exerciseId)}`} className="flex w-full items-center gap-1 text-left text-footnote text-label-2">
              <span className="truncate">{entry.skipped ? 'Skipped' : doneSummary(entry.sets, timed, usesAssist, units)}</span>
              <ChevronDown className="size-4 shrink-0" />
            </button>
          ) : (
            <div className="text-footnote text-label-2">
              {ex?.muscle} · {entry.plan ? `${entry.plan.sets} × ${fmtRange(entry.plan.repMin, entry.plan.repMax, timed)}` : 'Extra'}
              {entry.plan && ` · rest ${Math.round(entry.plan.restSec / 60 * 2) / 2} min`}
            </div>
          )}
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

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="sets"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="overflow-hidden"
          >
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
                  exIdx={index}
                  highlight={highlight === `${index}-${i}`}
                  onHold={(sec) => {
                    act((d) => updateSet(d, index, i, { actualReps: sec }));
                    toggle(i);
                  }}
                  onPatch={(patch) => act((d) => updateSet(d, index, i, patch))}
                  onToggle={() => toggle(i)}
                  onSkip={() => act((d) => skipSet(d, index, i))}
                  onRemove={() => act((d) => removeSet(d, index, i))}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Button variant="plain" size="sm" onClick={() => act((d) => addSet(d, index))}>
                <Plus className="size-4" strokeWidth={2.5} /> Add set
              </Button>
              {finished && (
                <Button variant="plain" size="sm" onClick={fold}>
                  Hide sets
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** "80 kg × 8 · 8 · 7" when the load held, else each set's load; "45 · 40s" for holds. */
function doneSummary(sets: SetRecord[], timed: boolean, assist: boolean, units: 'kg' | 'lb'): string {
  const done = sets.filter((s) => s.status === 'done');
  const skipped = sets.length - done.length;
  const tail = skipped ? ` · ${skipped} skipped` : '';
  if (!done.length) return 'All sets skipped';
  const reps = done.map((s) => s.actualReps ?? 0);
  if (timed) return `${reps.join(' · ')}s${tail}`;
  const load = (s: SetRecord) => (assist ? s.assistKg : s.actualKg) ?? 0;
  const fmt = (kg: number) => (kg > 0 ? `${assist ? 'assist ' : ''}${fmtLoad(kg, units)} × ` : '');
  const same = done.every((s) => load(s) === load(done[0]));
  const body = same ? `${fmt(load(done[0]))}${reps.join(' · ')}` : done.map((s, i) => `${fmt(load(s))}${reps[i]}`).join(' · ');
  return `${done.length} ${done.length === 1 ? 'set' : 'sets'} · ${body}${tail}`;
}

/** "Rested 1:12" while recovering, green "Ready" once this exercise's rest has passed. */
function Recovery({ last, restSec }: { last: number | null; restSec: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (last == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [last]);
  if (last == null) return null;
  const since = now - last;
  const ready = since >= restSec * 1000;
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-caption font-bold tabular', ready ? 'bg-green/15 text-[#248A3D]' : 'bg-orange/15 text-[#C93400]')}>
      {ready ? 'Ready' : `Rested ${fmtClock(since)}`}
    </span>
  );
}