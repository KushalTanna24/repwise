import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { streak } from '@/domain/streak';
import { toast } from '@/lib/toast';
import { useToday } from '@/lib/useToday';
import { useData } from '@/store/app';
import { Flame } from './Flame';

const IGNITED = 'repwise_ignited';
const FREEZE_SEEN = 'repwise_freeze_seen';
/** Fired when the overlay has gone, so the badge card can follow it. */
export const IGNITE_CLOSED = 'repwise:ignite-closed';
const EMBERS = [-46, -28, -12, 6, 20, 34, 50];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* it may play again next open; harmless */
  }
}

/** Plays once per day per device, the first time today becomes lit. */
export function IgniteOverlay() {
  const data = useData();
  const today = useToday();
  const s = streak(data, today);
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [rolled, setRolled] = useState(false);

  useEffect(() => {
    if (!s.todayLit || read(IGNITED) === today) return;
    write(IGNITED, today);
    setRolled(false);
    setOpen(true);
    navigator.vibrate?.(30);
  }, [s.todayLit, today]);

  useEffect(() => {
    const recent = s.freezeUsedOn && s.freezeUsedOn >= dayjs(today).subtract(2, 'day').format('YYYY-MM-DD');
    if (!recent || read(FREEZE_SEEN) === s.freezeUsedOn) return;
    write(FREEZE_SEEN, s.freezeUsedOn!);
    toast(`Freeze used. Streak safe at ${s.current}. ${s.freezes} left.`);
  }, [s.freezeUsedOn, today]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const roll = setTimeout(() => setRolled(true), reduce ? 0 : 450);
    const close = setTimeout(() => setOpen(false), 2500);
    return () => {
      clearTimeout(roll);
      clearTimeout(close);
    };
  }, [open, reduce]);

  const n = rolled ? s.current : Math.max(0, s.current - 1);
  return (
    <AnimatePresence onExitComplete={() => dispatchEvent(new Event(IGNITE_CLOSED))}>
      {open && (
        <motion.div
          key="ignite"
          role="status"
          onClick={() => setOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="relative">
            {!reduce &&
              EMBERS.map((x, i) => (
                <motion.i
                  key={i}
                  className="absolute bottom-6 left-1/2 size-2 rounded-full bg-[#FFB340]"
                  initial={{ x, y: 0, opacity: 1 }}
                  animate={{ x: x * 1.4, y: -170 - (i % 3) * 30, opacity: 0 }}
                  transition={{ duration: 1.3, delay: 0.25 + i * 0.05, ease: 'easeOut' }}
                />
              ))}
            <motion.div initial={reduce ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
              <Flame lit size={150} flicker />
            </motion.div>
          </div>
          <div className="mt-4 h-16 overflow-hidden text-[56px] font-black leading-[64px] text-white tabular">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={n}
                initial={reduce ? { opacity: 0 } : { y: 64 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { y: -64 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              >
                {n}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-1 text-title2 font-bold text-white">{s.current}-day streak!</div>
          <div className="mt-2 text-subhead text-white/70">Tap to continue</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
