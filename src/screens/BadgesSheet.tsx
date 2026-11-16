import dayjs from 'dayjs';
import { badgeProgress, BADGES, earnedBadges } from '@/domain/badges';
import { BADGE_ICON } from '@/components/BadgeCard';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useToday } from '@/lib/useToday';
import { useData } from '@/store/app';
import { Done } from './profile/Done';

export function BadgesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  // Always mounted; only do the work while it's showing.
  const earned = open ? earnedBadges(data, today) : new Map();
  return (
    <Sheet open={open} onClose={onClose} tall title="Badges" right={<Done onClose={onClose} />}>
      <p className="px-4 pb-3 text-subhead text-label-2">
        {earned.size} of {BADGES.length} earned
      </p>
      <div className="grid grid-cols-3 gap-2">
        {BADGES.map((b) => {
          const on = earned.get(b.id);
          const Icon = BADGE_ICON[b.id];
          const hint = on ? dayjs(on).format('D MMM YYYY') : badgeProgress(data, today, b.id);
          return (
            <div key={b.id} className={cn('flex flex-col items-center rounded-card bg-card p-3 text-center shadow-card', !on && 'opacity-50')} aria-label={`${b.title}, ${on ? `earned ${hint}` : 'locked'}`}>
              <span className={cn('grid size-12 place-items-center rounded-full', on ? 'bg-orange text-white' : 'bg-fill text-label-3')}>
                <Icon className="size-6" />
              </span>
              <div className="mt-2 text-footnote font-semibold leading-tight">{b.title}</div>
              <div className="mt-0.5 text-caption text-label-2">{hint ?? b.description}</div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
