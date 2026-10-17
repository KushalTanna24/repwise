import { CalendarDays, Dumbbell, TrendingUp, UserRound } from 'lucide-react';
import { go, useRoute, type Tab } from '@/lib/route';
import { cn } from '@/lib/cn';

const TABS: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
  { id: 'today', label: 'Today', icon: Dumbbell },
  { id: 'history', label: 'History', icon: CalendarDays },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

export function TabBar() {
  const tab = useRoute((r) => r.tab);
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-sep bg-card/80 backdrop-blur-xl">
      <div className="mx-auto grid h-[52px] max-w-[640px] grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn('flex flex-col items-center justify-center gap-[2px] text-[10px] font-medium', tab === id ? 'text-blue' : 'text-label-2')}
          >
            <Icon className="size-[24px]" strokeWidth={tab === id ? 2.4 : 1.9} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
