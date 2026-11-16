import { streak } from '@/domain/streak';
import { cn } from '@/lib/cn';
import { go } from '@/lib/route';
import { useToday } from '@/lib/useToday';
import { useData } from '@/store/app';
import { Flame } from './Flame';

/** Header chip: orange once today is lit, dimmed while pending. Opens History. */
export function StreakChip() {
  const s = streak(useData(), useToday());
  return (
    <button
      onClick={() => go('history')}
      aria-label={`${s.current}-day streak`}
      className={cn(
        'press flex items-center gap-1 rounded-full px-2 py-1 text-subhead font-bold tabular',
        s.todayLit ? 'bg-orange/15 text-[#C93400]' : 'bg-fill text-label-2',
      )}
    >
      <Flame lit={s.todayLit} size={18} />
      {s.current}
    </button>
  );
}
