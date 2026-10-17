import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Ellipsis, GlassWater, Minus, Pill, Play, Plus, RefreshCw, Repeat, SkipForward, Sparkles } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { rebuildPlan } from '@/domain/planner';
import { addWater, GLASS_ML } from '@/domain/water';
import { skipPlannedSession, startSession } from '@/domain/session';
import { SPLITS } from '@/domain/splits';
import { latestWeight, sessionVolume, weekStats } from '@/domain/stats';
import type { AppData, PlannedExercise, WorkoutSession } from '@/domain/types';
import { activeSupplements, toggleSupplement } from '@/domain/supplements';
import { cn } from '@/lib/cn';
import { Screen } from '@/components/Screen';
import { Rings } from '@/components/Rings';
import { Button } from '@/components/ui/button';
import { Card, List, Row, SectionHeader } from '@/components/ui/card';
import { Menu } from '@/components/ui/menu';
import { confirm } from '@/components/ui/alert';
import { exName, fmtClock, fmtDay, fmtDuration, fmtLoad, fmtRange, nowIso } from '@/lib/fmt';
import { go, openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useApp, useData } from '@/store/app';
import { SplitChooser } from './SplitPicker';
import { useProgressTab } from '@/lib/progressTab';
import { GuideButton } from './Guide';
import { NotifyPrompt } from '@/components/NotifyPrompt';

const RING = { workouts: '#FF2D55', sets: '#34C759', water: '#007AFF' };

export function Today() {
  const data = useData();
  const split = data.program.splitId;

  return (
    <Screen title="Today" eyebrow={dayjs().format('dddd, D MMMM')}>
      {!split ? (
        <>
          <p className="px-1 pb-4 pt-2 text-subhead text-label-2">Pick how you train. Repwise keeps your place in the rotation and builds every session from what you actually lift.</p>
          <SplitChooser />
          <Water data={data} />
          <Supplements data={data} />
        </>
      ) : (
        <>
          <UpNext data={data} />
          <NotifyPrompt />
          <Water data={data} />
          <Supplements data={data} />
          <Week data={data} />
          <Recent data={data} />
        </>
      )}
    </Screen>
  );
}

function UpNext({ data }: { data: AppData }) {
  const active = data.activeSession;
  const plan = data.plannedSession;
  const split = SPLITS[data.program.splitId!];
  if (!plan) return null;

  async function skip() {
    const ok = await confirm({
      title: `Skip ${plan!.title}?`,
      message: 'Moves the rotation to the next session. Nothing is logged.',
      confirmLabel: 'Skip',
    });
    if (ok) {
      act(skipPlannedSession);
      toast('Skipped. Next one is ready');
    }
  }

  function rebuild() {
    const next = rebuildPlan(useApp.getState().data);
    if (!next) return toast('No other accessories fit your equipment');
    act(() => next);
    toast('New accessories. Main lifts stay the same');
  }

  function start() {
    act((d) => startSession(d, nowIso()));
    openSheet('workout');
  }

  const today = dayjs().format('YYYY-MM-DD');
  const doneToday = !active ? [...data.sessions].reverse().find((s) => s.finishedAt && dayjs(s.startedAt).format('YYYY-MM-DD') === today) : undefined;
  const [open, setOpen] = useUpNextOpen(today, !doneToday);

  return (
    <>
      {doneToday && <DoneToday s={doneToday} />}
      <Card className="mt-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <button
          className="min-w-0 flex-1 text-left"
          aria-expanded={active ? true : open}
          onClick={() => !active && setOpen(!open)}
        >
          <div className="text-footnote font-semibold uppercase tracking-wide text-pink">{active ? 'In progress' : doneToday ? 'Next time' : 'Up next'}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-title2 font-bold">
            <span className="truncate">{active ? active.title : plan.title}</span>
            {!active && (
              <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 35 }} className="shrink-0 text-label-3">
                <ChevronRight className="size-5" strokeWidth={3} />
              </motion.span>
            )}
          </div>
          <RotationStrip titles={split.sessions.map((x) => x.title)} current={plan.sessionIndex} cycle={plan.cycle} count={plan.exercises.length} />
        </button>
        {!active && (
          <Menu
            label="Session options"
            trigger={
              <Button variant="gray" size="icon" aria-label="Session options">
                <Ellipsis className="size-5" />
              </Button>
            }
            items={[
              { label: 'Rebuild workout', icon: <RefreshCw className="size-4" />, onSelect: rebuild },
              { label: 'Skip this session', icon: <SkipForward className="size-4" />, onSelect: skip },
              { label: 'Change split', icon: <Repeat className="size-4" />, onSelect: () => openSheet('split') },
            ]}
          />
        )}
      </div>

      <AnimatePresence initial={false}>
        {!active && open && (
          <motion.ol
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="mt-3 overflow-hidden"
          >
            {plan.exercises.map((e, i) => (
              <PlanLine key={e.slotId} data={data} e={e} index={i} />
            ))}
          </motion.ol>
        )}
      </AnimatePresence>

      <div className="p-4">
        {active ? (
          <ResumeButton startedAt={active.startedAt} done={active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.status === 'done').length, 0)} />
        ) : (
          <Button size="lg" aria-label="Start workout" variant={doneToday ? 'tinted' : 'primary'} onClick={start} disabled={plan.exercises.every((e) => !e.exerciseId)}>
            <Play className="size-5 fill-current" />
            {doneToday ? `Start ${plan.title} anyway` : 'Start workout'}
          </Button>
        )}
      </div>
      </Card>
    </>
  );
}

const OPEN_KEY = 'repwise_upnext';

/** Open by default before today's workout, closed after; a manual toggle sticks for the day. */
function useUpNextOpen(today: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null') as { date: string; open: boolean } | null;
      return v?.date === today ? v.open : fallback;
    } catch {
      return fallback;
    }
  };
  const [open, setOpen] = useState(read);
  useEffect(() => setOpen(read()), [today, fallback]); // eslint-disable-line react-hooks/exhaustive-deps
  return [
    open,
    (v) => {
      setOpen(v);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify({ date: today, open: v }));
      } catch {
        /* per-session only */
      }
    },
  ];
}

/** Where you are in the split: one chip per session, current one filled. Not a weekly count. */
function RotationStrip({ titles, current, cycle, count }: { titles: string[]; current: number; cycle: number; count: number }) {
  const short = (t: string) => t.replace(/^Full Body /, '');
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-footnote text-label-2">
      {titles.map((t, i) => (
        <span
          key={t}
          className={cn(
            'rounded-full px-2 py-0.5 text-caption font-bold',
            i === current ? 'bg-pink text-white' : i < current ? 'bg-pink/15 text-pink' : 'bg-fill text-label-2',
          )}
        >
          {short(t)}
        </span>
      ))}
      <span>· Cycle {cycle} · {count} exercises</span>
    </div>
  );
}

function DoneToday({ s }: { s: WorkoutSession }) {
  const v = sessionVolume(s);
  return (
    <button onClick={() => openSheet(`session:${s.id}`)} className="press mt-4 flex w-full items-center gap-3 rounded-card bg-green p-4 text-left text-white shadow-card">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
        <Check className="size-6" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-footnote font-semibold uppercase tracking-wide text-white/80">Done today</div>
        <div className="truncate text-title3 font-bold">{s.title}</div>
        <div className="text-subhead text-white/85">
          {fmtDuration(Date.parse(s.finishedAt!) - Date.parse(s.startedAt))} · {v.sets} sets
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-white/70" />
    </button>
  );
}

function PlanLine({ data, e, index }: { data: AppData; e: PlannedExercise; index: number }) {
  const ex = getExercise(e.exerciseId, data.customExercises);
  const timed = ex?.kind === 'timed';
  const load = e.rec.targetKg != null && e.rec.targetKg > 0 ? fmtLoad(e.rec.targetKg, data.profile.units) : ex?.kind === 'weighted' ? 'Pick load' : null;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 py-2 pl-4 [&:not(:last-child)>:last-child]:border-b [&:not(:last-child)>:last-child]:border-sep"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fill text-footnote font-bold tabular text-label-2">{index + 1}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-4">
        <div className="min-w-0 flex-1">
          <div className={e.exerciseId ? 'truncate text-body' : 'truncate text-body text-orange'}>{exName(data, e.exerciseId)}</div>
          <div className="truncate text-footnote text-label-2">
            {e.sets} × {fmtRange(e.repMin, e.repMax, timed)}
            {e.role === 'anchor' && ' · main lift'}
          </div>
        </div>
        {load && <span className="shrink-0 text-subhead font-semibold tabular text-label-2">{load}</span>}
        <GuideButton id={e.exerciseId} />
      </div>
    </motion.li>
  );
}

function ResumeButton({ startedAt, done }: { startedAt: string; done: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Button size="lg" variant="success" onClick={() => openSheet('workout')}>
      Resume · {fmtClock(now - Date.parse(startedAt))} · {done} sets
    </Button>
  );
}

function Week({ data }: { data: AppData }) {
  const w = weekStats(data, nowIso());
  const target = data.profile.daysPerWeek;
  const setTarget = target * 15;
  const glasses = data.water[dayjs().format('YYYY-MM-DD')] ?? 0;
  const goal = data.profile.waterGoal;
  return (
    <>
      <SectionHeader title="This week" />
      <Card className="flex items-center gap-5 p-4">
        <Rings
          rings={[
            { label: 'Workouts', value: w.sessions, max: target, color: RING.workouts },
            { label: 'Sets', value: w.sets, max: setTarget, color: RING.sets },
            { label: 'Water today', value: glasses, max: goal, color: RING.water },
          ]}
        />
        <dl className="grid flex-1 gap-2">
          <Stat color={RING.workouts} label="Workouts" value={`${w.sessions}/${target}`} />
          <Stat color={RING.sets} label="Sets" value={`${w.sets}/${setTarget}`} />
          <Stat color={RING.water} label="Water today" value={`${glasses}/${goal}`} />
        </dl>
      </Card>
      <p className="px-4 pt-2 text-footnote text-label-2">
        {w.streakWeeks > 0 ? `${w.streakWeeks}-week streak of hitting ${target} workouts. Keep it going.` : `Hit ${target} workouts this week to start a streak.`}
      </p>
    </>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div>
      <dt className="text-footnote font-semibold text-label-2">{label}</dt>
      <dd className="text-title3 font-bold tabular" style={{ color }}>
        {value}
      </dd>
    </div>
  );
}

function Recent({ data }: { data: AppData }) {
  const last = [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const weight = latestWeight(data);
  return (
    <>
      <SectionHeader title="Recently" />
      <List>
        {last ? (
          <Row
            title={last.title}
            subtitle={`${fmtDay(last.startedAt)} · ${sessionVolume(last).sets} sets`}
            onClick={() => openSheet(`session:${last.id}`)}
            chevron
          />
        ) : (
          <Row title="No workouts yet" subtitle="Your first session shows up here" />
        )}
        <Row
          title="Body weight"
          subtitle={weight ? fmtDay(weight.date) : 'Add a weigh-in to track your trend'}
          value={weight ? fmtLoad(weight.kg, data.profile.units) : undefined}
          onClick={() => {
            useProgressTab.setState({ tab: 'body' });
            go('progress');
          }}
          chevron
        />
      </List>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="tinted" onClick={() => openSheet('extra')}>
          <Plus className="size-4" strokeWidth={2.5} /> Log extra
        </Button>
        <Button variant="tinted" onClick={() => openSheet('split')}>
          <Sparkles className="size-4" /> Split
        </Button>
      </div>
    </>
  );
}

function Water({ data }: { data: AppData }) {
  const today = dayjs().format('YYYY-MM-DD');
  const glasses = data.water[today] ?? 0;
  const goal = data.profile.waterGoal;
  const done = glasses >= goal;

  function add(delta: number) {
    navigator.vibrate?.(10);
    act((d) => addWater(d, today, delta));
    if (delta > 0 && glasses + 1 === goal) toast('Water goal hit 💧');
  }

  return (
    <Card className="mt-3 flex items-center gap-3 p-3 pl-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue/12 text-blue">
        <GlassWater className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-headline font-semibold tabular">
          {glasses} <span className="font-normal text-label-2">/ {goal} glasses</span>
        </div>
        <div className="mt-1 flex gap-[3px]" aria-hidden>
          {Array.from({ length: goal }, (_, i) => (
            <motion.span
              key={i}
              initial={false}
              animate={{ backgroundColor: i < glasses ? '#007AFF' : 'rgba(118,118,128,0.16)' }}
              className="h-1.5 flex-1 rounded-full"
            />
          ))}
        </div>
        <div className="mt-1 text-caption text-label-2">{((glasses * GLASS_ML) / 1000).toFixed(2).replace(/0$/, '')} L{done ? ' · goal hit' : ''}</div>
      </div>
      {glasses > 0 && (
        <Button variant="gray" size="icon" aria-label="Remove a glass" onClick={() => add(-1)}>
          <Minus className="size-4" strokeWidth={2.5} />
        </Button>
      )}
      <Button variant="primary" className="h-11 px-4" aria-label="Add a glass of water" onClick={() => add(1)}>
        <Plus className="size-4" strokeWidth={3} /> Glass
      </Button>
    </Card>
  );
}
function Supplements({ data }: { data: AppData }) {
  const today = dayjs().format('YYYY-MM-DD');
  const stack = activeSupplements(data);
  const taken = data.suppLog[today] ?? [];

  if (!stack.length)
    return (
      <button onClick={() => go('profile')} className="press mt-3 flex w-full items-center gap-3 rounded-card bg-card p-3 pl-4 text-left shadow-card">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-purple/12 text-purple">
          <Pill className="size-5" />
        </span>
        <div className="flex-1">
          <div className="text-headline font-semibold">Supplements</div>
          <div className="text-footnote text-label-2">Add your stack in Profile to tick it off daily</div>
        </div>
        <ChevronRight className="size-4 text-label-3" />
      </button>
    );

  return (
    <Card className="mt-3 p-3 pl-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-purple/12 text-purple">
          <Pill className="size-5" />
        </span>
        <div className="text-headline font-semibold tabular">
          {taken.filter((id) => stack.some((s) => s.id === id)).length} <span className="font-normal text-label-2">/ {stack.length} taken</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {stack.map((s) => {
          const on = taken.includes(s.id);
          return (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.94 }}
              aria-pressed={on}
              aria-label={`${s.name}${on ? ' taken' : ''}`}
              onClick={() => {
                navigator.vibrate?.(10);
                act((d) => toggleSupplement(d, today, s.id));
              }}
              className={cn('flex h-9 items-center gap-1.5 rounded-full px-3.5 text-subhead font-semibold transition-colors', on ? 'bg-purple text-white' : 'bg-fill text-label')}
            >
              {on && <Check className="size-4" strokeWidth={3} />}
              {s.name}
              {s.dose && <span className={on ? 'font-normal text-white/80' : 'font-normal text-label-2'}>{s.dose}</span>}
            </motion.button>
          );
        })}
      </div>
    </Card>
  );
}