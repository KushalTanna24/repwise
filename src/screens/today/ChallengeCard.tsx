import { Check, ChevronRight, Trophy } from 'lucide-react';
import { dayNumber, taskDone, toggleTask } from '@/domain/challenges';
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
            {run.tasks.map((t) => {
              const done = taskDone(data, run, t, today);
              return (
                <button
                  key={t.id}
                  role="checkbox"
                  aria-checked={done}
                  aria-label={t.label}
                  disabled={!!t.auto}
                  onClick={() => act((d) => toggleTask(d, run.id, t.id, today, today))}
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-1.5 text-left"
                >
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', done ? 'border-green bg-green text-white' : 'border-label-3')}>
                    {done && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <span className={cn('min-w-0 flex-1 text-body', done && 'text-label-2')}>{t.label}</span>
                  {t.auto && <span className="shrink-0 text-footnote text-label-2">{AUTO_NOTE[t.auto]}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </Card>
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
