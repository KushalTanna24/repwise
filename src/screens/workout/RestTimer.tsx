import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Timer, X } from 'lucide-react';
import { create } from 'zustand';
import { fmtClock } from '@/lib/fmt';

const KEY = 'repwise_rest';

interface Rest {
  endsAt: number | null;
  total: number;
}

function load(): Rest {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Rest | null;
    return r && r.endsAt && r.endsAt > Date.now() ? r : { endsAt: null, total: 0 };
  } catch {
    return { endsAt: null, total: 0 };
  }
}

/** Survives a refresh so the countdown keeps running. */
export const useRest = create<Rest>(() => load());
useRest.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* non-essential */
  }
});

export const startRest = (sec: number) => useRest.setState({ endsAt: Date.now() + sec * 1000, total: sec });
const stopRest = () => useRest.setState({ endsAt: null, total: 0 });
const addRest = (sec: number) => useRest.setState((s) => (s.endsAt ? { endsAt: s.endsAt + sec * 1000, total: s.total + sec } : s));

export function RestTimer() {
  const { endsAt, total } = useRest();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endsAt) {
        navigator.vibrate?.([200, 100, 200]);
        stopRest();
      }
    }, 250);
    return () => clearInterval(t);
  }, [endsAt]);

  const left = endsAt ? endsAt - now : 0;
  const pct = total ? Math.max(0, Math.min(1, left / (total * 1000))) : 0;

  return (
    <AnimatePresence>
      {endsAt && left > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="sticky bottom-3 z-10 mx-auto mt-4 flex w-full max-w-[420px] items-center gap-3 overflow-hidden rounded-full bg-label/92 py-2 pl-4 pr-2 text-white shadow-xl backdrop-blur-xl"
          role="timer"
          aria-label="Rest timer"
        >
          <div className="absolute inset-y-0 left-0 bg-white/12 transition-[width] duration-300 ease-linear" style={{ width: `${pct * 100}%` }} />
          <Timer className="relative size-5 text-orange" />
          <div className="relative flex-1">
            <div className="text-caption font-semibold uppercase tracking-wide text-white/60">Rest</div>
            <div className="text-title3 font-bold tabular leading-none">{fmtClock(left)}</div>
          </div>
          <button onClick={() => addRest(15)} className="press relative h-9 rounded-full bg-white/15 px-3 text-subhead font-semibold">
            +15s
          </button>
          <button onClick={stopRest} aria-label="Skip rest" className="press relative grid size-9 place-items-center rounded-full bg-white/15">
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
