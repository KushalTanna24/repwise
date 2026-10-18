import { useState } from 'react';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { dayMarks, monthCells, nextGoal } from '@/domain/calendar';
import type { AppData } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

const DOT = { workout: '#FF2D55', water: '#007AFF', supps: '#AF52DE' };
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  data: AppData;
  selected: string | null;
  onSelect: (date: string | null) => void;
}

/** Month view: dots for workout / water goal / full supplements, an orange ring on goal dates. */
export function Calendar({ data, selected, onSelect }: Props) {
  const today = dayjs().format('YYYY-MM-DD');
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [dir, setDir] = useState(0);
  const goal = nextGoal(data, today);

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
            const m = dayMarks(data, c.date);
            const isToday = c.date === today;
            const isSel = c.date === selected;
            const goalDay = m.goals.length > 0;
            return (
              <button
                key={c.date}
                aria-label={`${dayjs(c.date).format('D MMMM')}${m.workout ? ', workout' : ''}${m.water ? ', water goal' : ''}${m.supps ? ', supplements' : ''}${goalDay ? `, goal: ${m.goals.join(', ')}` : ''}`}
                aria-pressed={isSel}
                onClick={() => onSelect(isSel ? null : c.date)}
                className={cn('flex h-12 flex-col items-center justify-start gap-0.5 pt-1', !c.inMonth && 'opacity-30')}
              >
                <span
                  className={cn(
                    'relative grid size-8 place-items-center rounded-full text-subhead tabular',
                    isSel ? 'bg-label text-white' : isToday ? 'bg-pink text-white font-semibold' : '',
                    goalDay && !isSel && 'ring-2 ring-orange',
                  )}
                >
                  {Number(c.date.slice(8))}
                  {goalDay && <Flag className="absolute -right-1 -top-1 size-3 fill-orange text-orange" />}
                </span>
                <span className="flex h-1.5 gap-[3px]">
                  {m.workout && <i className="size-1.5 rounded-full" style={{ background: DOT.workout }} />}
                  {m.water && <i className="size-1.5 rounded-full" style={{ background: DOT.water }} />}
                  {m.supps && <i className="size-1.5 rounded-full" style={{ background: DOT.supps }} />}
                </span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-sep pt-2 text-caption text-label-2">
        <Legend color={DOT.workout} label="Workout" />
        <Legend color={DOT.water} label="Water goal" />
        <Legend color={DOT.supps} label="All supplements" />
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
