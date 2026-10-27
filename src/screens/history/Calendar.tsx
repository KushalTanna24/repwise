import { useState } from 'react';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Flag, Snowflake } from 'lucide-react';
import { deadlinesOn, monthCells, nextGoal } from '@/domain/calendar';
import { GOAL_COLOR, GOAL_LABEL, goalIndex, type Goal, type GoalKind } from '@/domain/goals';
import { streak } from '@/domain/streak';
import type { AppData } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  data: AppData;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  /** Dims days where this kind of goal wasn't done. */
  filter: GoalKind | null;
  /** Kinds shown in the legend. */
  kinds: GoalKind[];
}

const FILL = { lit: 'bg-orange/20', frozen: 'bg-blue/15', leave: 'bg-fill', missed: '' };

/** Month view coloured by streak state, one dot per goal done, an orange ring on goal dates. */
export function Calendar({ data, today, selected, onSelect, filter, kinds }: Props) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [dir, setDir] = useState(0);
  const goal = nextGoal(data, today);
  const goalsAt = goalIndex(data);
  const days = streak(data, today).days;

  const shift = (n: number) => {
    setDir(n);
    setMonth(dayjs(`${month}-01`).add(n, 'month').format('YYYY-MM'));
  };

  return (
    <Card className="mt-3 p-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-headline font-semibold">{dayjs(`${month}-01`).format('MMMM YYYY')}</div>
        <div className="flex gap-1">
          <button aria-label="Previous month" onClick={() => shift(-1)} className="press grid size-8 place-items-center rounded-full text-blue">
            <ChevronLeft className="size-5" strokeWidth={2.5} />
          </button>
          <button aria-label="Next month" onClick={() => shift(1)} className="press grid size-8 place-items-center rounded-full text-blue">
            <ChevronRight className="size-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {goal && (
        <div className="mx-1 mt-2 flex items-center gap-2 rounded-[10px] bg-orange/12 px-3 py-2 text-footnote font-semibold text-[#C93400]">
          <Flag className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{goal.title}</span>
          <span className="shrink-0 tabular">{goal.daysLeft === 0 ? 'today' : `${goal.daysLeft} days · ${dayjs(goal.date).format('D MMM')}`}</span>
        </div>
      )}

      <div className="mt-2 grid grid-cols-7 text-center text-caption font-semibold text-label-3">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={month}
          custom={dir}
          initial={{ x: dir * 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: dir * -40, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, i) => (i.offset.x < -50 ? shift(1) : i.offset.x > 50 ? shift(-1) : undefined)}
          className="mt-1 grid grid-cols-7 gap-y-1"
        >
          {monthCells(month).map((c) => {
            const done: Goal[] = goalsAt(c.date).filter((g) => g.status.done);
            const deadlines = deadlinesOn(data, c.date);
            const isToday = c.date === today;
            const isSel = c.date === selected;
            const goalDay = deadlines.length > 0;
            const state = days.get(c.date);
            const dimmed = filter && !done.some((g) => g.kind === filter);
            return (
              <button
                key={c.date}
                aria-label={`${dayjs(c.date).format('D MMMM')}${state && state !== 'missed' ? `, ${state}` : ''}${done.map((g) => `, ${g.label}`).join('')}${goalDay ? `, goal: ${deadlines.join(', ')}` : ''}`}
                aria-pressed={isSel}
                onClick={() => onSelect(c.date)}
                className={cn('flex h-12 flex-col items-center justify-start gap-0.5 pt-1 transition-opacity', !c.inMonth && 'opacity-30', c.inMonth && dimmed && 'opacity-35')}
              >
                <span
                  className={cn(
                    'relative grid size-8 place-items-center rounded-full text-subhead tabular',
                    isSel ? 'bg-label text-white' : state ? FILL[state] : '',
                    isToday && !isSel && 'font-bold text-pink',
                    goalDay && !isSel ? 'ring-2 ring-orange' : isToday && !isSel && 'ring-2 ring-pink',
                  )}
                >
                  {Number(c.date.slice(8))}
                  {goalDay && <Flag className="absolute -right-1 -top-1 size-3 fill-orange text-orange" />}
                  {state === 'frozen' && <Snowflake className="absolute -bottom-1 -right-1 size-3 text-blue" />}
                </span>
                <span className="flex h-1.5 gap-[3px]">
                  {done.map((g) => (
                    <i key={g.id} className="size-1.5 rounded-full" style={{ background: g.color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-sep pt-2 text-caption text-label-2">
        {kinds.map((k) => (
          <Legend key={k} color={GOAL_COLOR[k]} label={GOAL_LABEL[k]} />
        ))}
        <span className="flex items-center gap-1">
          <Flag className="size-3 fill-orange text-orange" /> Goal date
        </span>
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <i className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
