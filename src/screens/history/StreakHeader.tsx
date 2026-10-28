import dayjs from 'dayjs';
import { ChevronRight, Snowflake } from 'lucide-react';
import { currentLeave } from '@/domain/leave';
import { streak } from '@/domain/streak';
import type { AppData } from '@/domain/types';
import { Flame } from '@/components/Flame';
import { openSheet } from '@/lib/route';

/** Flame, count, best and freezes. Opens the badges sheet. */
export function StreakHeader({ data, today }: { data: AppData; today: string }) {
  const s = streak(data, today);
  const leave = currentLeave(data, today);
  return (
    <button
      onClick={() => openSheet('badges')}
      aria-label={`${s.current}-day streak, best ${s.best}. Open badges`}
      className="press mt-3 flex w-full items-center gap-4 rounded-card bg-card p-4 text-left shadow-card"
    >
      <Flame lit={s.current > 0} size={56} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[34px] font-black leading-none tabular">{s.current}</span>
          <span className="text-headline font-semibold text-label-2">day streak</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-subhead text-label-2">
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
      <ChevronRight className="size-5 shrink-0 text-label-3" />
    </button>
  );
}
