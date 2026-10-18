import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'motion/react';
import { greeting, shouldAnnounce, shouldGreet } from '@/lib/alerts';
import { notify } from '@/lib/notify';
import { useData } from '@/store/app';
import { useLaunch } from './Splash';

const KEY = 'repwise_last_greet';
const VERSION_KEY = 'repwise_seen_version';

/** Shown once on the first open of a new version. */
const WHATS_NEW = {
  version: __APP_VERSION__,
  title: 'Repwise updated',
  body: 'Sign-in now confirms itself, supplement library, tidier Profile, water reminders.',
};

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* banner may repeat; harmless */
  }
}
const SHOW_MS = 6000;

function lastGreet() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** iOS-style notification banner, once per day on first open. Swipe up or tap to dismiss. */
export function DailyBanner() {
  const data = useData();
  const splashDone = useLaunch((s) => s.splashDone);
  const [open, setOpen] = useState(false);
  const [news, setNews] = useState(false);
  const today = dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    if (!splashDone) return;
    const announce = shouldAnnounce(read(VERSION_KEY), WHATS_NEW.version, read(KEY) != null || data.sessions.length > 0);
    write(VERSION_KEY, WHATS_NEW.version);
    if (!announce && !shouldGreet(lastGreet(), today)) return;
    write(KEY, today);
    if (announce) {
      setNews(true);
      void notify(WHATS_NEW.title, WHATS_NEW.body, 'update', '/');
    }
    const show = setTimeout(() => setOpen(true), 250);
    const hide = setTimeout(() => setOpen(false), 250 + (announce ? SHOW_MS * 1.6 : SHOW_MS));
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splashDone]);

  const plan = data.plannedSession;
  const glasses = data.water[today] ?? 0;
  const trainedToday = data.sessions.some((s) => s.finishedAt && dayjs(s.startedAt).format('YYYY-MM-DD') === today);
  const body = data.activeSession
    ? `Your ${data.activeSession.title} is still open. Pick up where you left off.`
    : trainedToday
      ? `Workout done today. Water ${glasses}/${data.profile.waterGoal}.`
      : plan
        ? `Up next: ${plan.title}, ${plan.exercises.length} exercises. Water ${glasses}/${data.profile.waterGoal}.`
        : 'Pick your split to get your first session.';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          data-banner
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.6, bottom: 0.1 }}
          onDragEnd={(_, i) => i.offset.y < -30 && setOpen(false)}
          onClick={() => setOpen(false)}
          className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+8px)] z-[90] mx-auto flex max-w-[620px] cursor-grab items-start gap-3 rounded-[22px] bg-[rgb(250_250_250/0.85)] p-3 shadow-[0_8px_30px_rgb(0_0_0/0.18)] backdrop-blur-2xl backdrop-saturate-150"
        >
          <img src="/icon.svg" alt="" className="size-[38px] shrink-0 rounded-[9px]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-footnote font-semibold text-label">{news ? `${WHATS_NEW.title} ✨` : greeting(new Date().getHours())}</span>
              <span className="text-caption text-label-2">now</span>
            </div>
            <p className="text-subhead leading-snug text-label">{news ? WHATS_NEW.body : body}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}