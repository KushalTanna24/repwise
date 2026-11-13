import dayjs from 'dayjs';
import { ChevronRight, Snowflake } from 'lucide-react';
import { currentLeave } from '@/domain/leave';
import { streak } from '@/domain/streak';
import type { AppData } from '@/domain/types';
import { Flame } from '@/components/Flame';
import { openSheet } from '@/lib/route';
import { cn } from '@/lib/cn';
import { useDoc } from '@/store/docContext';

/** Flame, count, best and freezes. Opens the badges sheet, except on someone else's history. */
export function StreakHeader({ data, today }: { data: AppData; today: string }) {
  const s = streak(data, today);
  const leave = currentLeave(data, today);
  const { readOnly } = useDoc();
  const Box = readOnly ? 'div' : 'button';
  return (
    <Box
      onClick={readOnly ? undefined : () => openSheet('badges')}
      aria-label={readOnly ? undefined : `${s.current}-day streak, best ${s.best}. Open badges`}
      className={cn('mt-3 flex w-full items-center gap-3 rounded-card bg-card px-4 py-3 text-left shadow-card', !readOnly && 'press')}
    >
      <Flame lit={s.current > 0} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-black leading-none tabular">{s.current}</span>
          <span className="text-headline font-semibold text-label-2">day streak</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-label-2">
          <span className="tabular">Best {s.best}</span>
          <span className="flex items-center gap-0.5" aria-label={`${s.freezes} freezes`}>
            {s.freezes === 0 ? 'No freezes' : Array.from({ length: s.freezes }, (_, i) => <Snowflake key={i} className="size-4 text-blue" />)}
          </span>
          {leave && (
            <span className="rounded-full bg-fill px-2 py-0.5 text-footnote font-semibold">
              On leave{leave.end ? ` until ${dayjs(leave.end).format('D MMM')}` : ''}
            </span>
          )}
        </div>
      </div>
      {!readOnly && <ChevronRight className="size-5 shrink-0 text-label-3" />}
    </Box>
  );
}
