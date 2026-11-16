import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Dumbbell, Flame, GlassWater, ListChecks, Medal, Mountain, Timer, Trophy, type LucideIcon } from 'lucide-react';
import { BADGES, markBadgesSeen, unseenBadges, type BadgeId } from '@/domain/badges';
import { useToday } from '@/lib/useToday';
import { act, useData } from '@/store/app';
import { Button } from './ui/button';
import { IGNITE_CLOSED } from './IgniteOverlay';

export const BADGE_ICON: Record<BadgeId, LucideIcon> = {
  'streak-3': Flame,
  'streak-7': Flame,
  'streak-30': Flame,
  'streak-100': Flame,
  'streak-365': Flame,
  'first-workout': Dumbbell,
  'first-pr': Medal,
  'workouts-50': Trophy,
  'workouts-100': Trophy,
  'hydrated-week': GlassWater,
  'finish-75': Mountain,
  'finish-stack': ListChecks,
  'finish-custom': Trophy,
  'fast-24': Timer,
  'fast-36': Timer,
};

/** Springs up once per new badge; sits under the ignite overlay so it lands after it. */
export function BadgeCard() {
  const data = useData();
  const today = useToday();
  const reduce = useReducedMotion();
  const next = unseenBadges(data, today)[0];
  const badge = BADGES.find((b) => b.id === next);
  // Re-run the entrance after the ignite overlay leaves, so the card is seen arriving.
  const [entrance, setEntrance] = useState(0);
  useEffect(() => {
    const again = () => setEntrance((n) => n + 1);
    addEventListener(IGNITE_CLOSED, again);
    return () => removeEventListener(IGNITE_CLOSED, again);
  }, []);

  const Icon = next ? BADGE_ICON[next] : Trophy;
  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          key={`${badge.id}-${entrance}`}
          role="status"
          initial={reduce ? { opacity: 0 } : { y: 160, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: 160, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="fixed inset-x-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[75] mx-auto flex max-w-[600px] items-center gap-3 rounded-card bg-card p-4 shadow-[0_12px_40px_rgb(0_0_0/0.22)]"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-orange text-white">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-footnote font-semibold uppercase tracking-wide text-orange">New badge</div>
            <div className="truncate text-headline font-semibold">{badge.title}</div>
            <div className="truncate text-subhead text-label-2">{badge.description}</div>
          </div>
          <Button size="sm" onClick={() => act((d) => markBadgesSeen(d, [badge.id]))}>
            Nice
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
