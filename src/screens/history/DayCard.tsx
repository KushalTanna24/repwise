import { useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Dumbbell, Footprints, GlassWater, Pill, Sparkles, StretchHorizontal, Timer, Trophy } from 'lucide-react';
import { taskDone } from '@/domain/challenges';
import { elapsedHours, fastReached, fastsEndedOn } from '@/domain/fasting';
import { goalIndex, type Goal, type GoalKind } from '@/domain/goals';
import { sessionVolume } from '@/domain/stats';
import { activeSupplements } from '@/domain/supplements';
import type { AppData, ExtraSession, WorkoutSession } from '@/domain/types';
import { Card, Empty, List, Row } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { fmtDuration } from '@/lib/fmt';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act } from '@/store/app';

const KIND_ICON: Record<GoalKind, typeof Dumbbell> = { workout: Dumbbell, water: GlassWater, supplements: Pill, challenge: Trophy, fast: Timer };
const EXTRA_ICON = { run: Footprints, mobility: StretchHorizontal, skills: Sparkles };
const EXTRA_NAME = { run: 'Run', mobility: 'Mobility', skills: 'Skills' };

/** Something was logged that day, even if no goal was reached. */
const anyLogged = (goals: Goal[]) =>
  goals.some((g) => g.status.done || (g.status.progress?.[0] ?? 0) > 0) || goals.some((g) => g.kind === 'challenge');

/** The selected day: one standard row per goal, each expanding inline. */
export function DayCard({ data, date }: { data: AppData; date: string }) {
  const goals = goalIndex(data)(date);
  const [open, setOpen] = useState<string | null>(null);
  if (!anyLogged(goals)) return <Empty title={`Nothing logged on ${dayjs(date).format('ddd D MMM')}.`} />;

  return (
    <Card className="mt-3 overflow-hidden">
      <div className="px-4 pb-1 pt-3 text-footnote font-semibold uppercase tracking-wide text-label-2">{dayjs(date).format('dddd D MMMM')}</div>
      {goals.map((g) => {
        const Icon = KIND_ICON[g.kind];
        const isOpen = open === g.id;
        return (
          <div key={g.id} className="border-t border-sep first-of-type:border-t-0">
            <button
              aria-label={`${g.label} details`}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : g.id)}
              className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left active:bg-fill-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: g.color }}>
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">{g.label}</span>
                {g.status.detail && <span className="block truncate text-footnote text-label-2">{g.status.detail}</span>}
              </span>
              {g.status.done ? (
                <Check className="size-5 shrink-0 text-green" strokeWidth={3} aria-label="Done" />
              ) : g.status.progress ? (
                <span className="shrink-0 text-subhead text-label-2 tabular">
                  {g.status.progress[0]}/{g.status.progress[1]}
                </span>
              ) : null}
              <motion.span animate={{ rotate: isOpen ? 90 : 0 }} className="shrink-0 text-label-3">
                <ChevronRight className="size-4" strokeWidth={2.5} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                  className="overflow-hidden bg-fill-2"
                >
                  <Detail data={data} date={date} goal={g} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </Card>
  );
}

function Detail({ data, date, goal }: { data: AppData; date: string; goal: Goal }) {
  switch (goal.kind) {
    case 'workout':
      return <WorkoutDetail data={data} date={date} />;
    case 'water':
      return <Line>{`${data.water[date] ?? 0} of ${data.profile.waterGoal} glasses`}</Line>;
    case 'supplements': {
      const taken = data.suppLog[date] ?? [];
      return (
        <div className="py-1">
          {activeSupplements(data).map((p) => (
            <Line key={p.id} done={taken.includes(p.id)}>
              {p.name}
            </Line>
          ))}
        </div>
      );
    }
    case 'challenge': {
      const run = data.challenges.find((r) => r.id === goal.runId)!;
      return (
        <div className="py-1">
          {run.tasks.map((t) => (
            <Line key={t.id} done={taskDone(data, run, t, date)}>
              {t.label}
            </Line>
          ))}
        </div>
      );
    }
    case 'fast':
      return (
        <div className="py-1">
          {fastsEndedOn(data, date).map((f) => (
            <Line key={f.id} done={fastReached(f)}>
              {`${dayjs(f.startedAt).format('ddd HH:mm')} to ${dayjs(f.endedAt!).format('HH:mm')} · ${elapsedHours(f, f.endedAt!).toFixed(1)}h of ${f.targetHours}h`}
            </Line>
          ))}
        </div>
      );
  }
}

function Line({ children, done }: { children: ReactNode; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 pl-16 text-subhead">
      {done !== undefined && <Check className={cn('size-4 shrink-0', done ? 'text-green' : 'text-label-3 opacity-40')} strokeWidth={3} />}
      <span className={cn('min-w-0 flex-1', done === false && 'text-label-2')}>{children}</span>
    </div>
  );
}

function WorkoutDetail({ data, date }: { data: AppData; date: string }) {
  const sessions = data.sessions.filter((s) => s.finishedAt && dayjs(s.startedAt).format('YYYY-MM-DD') === date);
  const extras = data.extras.filter((x) => x.date === date);
  if (!sessions.length && !extras.length) return <Line>Not logged</Line>;

  async function removeExtra(x: ExtraSession) {
    const ok = await confirm({ title: 'Delete this entry?', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    act((d) => ({ ...d, extras: d.extras.filter((e) => e.id !== x.id) }));
    toast('Deleted');
  }

  return (
    <List className="m-0 rounded-none bg-transparent shadow-none">
      {sessions.map((s) => (
        <SessionRow key={s.id} s={s} />
      ))}
      {extras.map((x) => (
        <ExtraRow key={x.id} x={x} onClick={() => void removeExtra(x)} />
      ))}
    </List>
  );
}

function SessionRow({ s }: { s: WorkoutSession }) {
  const v = sessionVolume(s);
  const partial = s.exercises.some((e) => e.sets.some((x) => x.status === 'skipped'));
  return (
    <Row
      className="pl-16"
      title={s.title}
      subtitle={`${v.sets} sets · ${fmtDuration(Date.parse(s.finishedAt!) - Date.parse(s.startedAt))}${partial ? ' · partial' : ''}`}
      onClick={() => openSheet(`session:${s.id}`)}
      chevron
    />
  );
}

function ExtraRow({ x, onClick }: { x: ExtraSession; onClick: () => void }) {
  const I = EXTRA_ICON[x.type];
  const bits = [x.distanceKm != null && `${x.distanceKm} km`, x.minutes != null && `${x.minutes} min`, x.note].filter(Boolean).join(' · ');
  return (
    <Row
      className="pl-16"
      leading={<I className="size-[18px] shrink-0 text-label-2" />}
      title={EXTRA_NAME[x.type]}
      subtitle={bits ? `${bits} · tap to delete` : 'Tap to delete'}
      onClick={onClick}
    />
  );
}
