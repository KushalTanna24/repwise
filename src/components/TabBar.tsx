import { CalendarDays, Dumbbell, TrendingUp, UserRound, Users } from 'lucide-react';
import { go, useRoute, type Tab } from '@/lib/route';
import { useNudges } from '@/lib/groups';
import { cn } from '@/lib/cn';

const TABS: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
  { id: 'today', label: 'Today', icon: Dumbbell },
  { id: 'history', label: 'History', icon: CalendarDays },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

export function TabBar() {
  const tab = useRoute((r) => r.tab);
  const { unreadCount } = useNudges();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-sep bg-card/80 backdrop-blur-xl">
      <div className="mx-auto grid h-[52px] max-w-[640px] grid-cols-5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            aria-current={tab === id ? 'page' : undefined}
            aria-label={id === 'groups' && unreadCount ? `${label}, ${unreadCount} new nudges` : undefined}
            className={cn('flex flex-col items-center justify-center gap-[2px] text-[10px] font-medium', tab === id ? 'text-blue' : 'text-label-2')}
          >
            <span className="relative">
              <Icon className="size-[24px]" strokeWidth={tab === id ? 2.4 : 1.9} />
              {id === 'groups' && unreadCount > 0 && <span className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-red ring-2 ring-card" />}
            </span>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
