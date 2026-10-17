import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useApp } from '@/store/app';

const LOGO_MS = 650;
const NOTE_MS = 1700;

/** Quick launch reveal: logo, name, then the goal note. Tap anywhere to skip. */
export function Splash() {
  const reduce = useReducedMotion();
  const hydrated = useApp((s) => s.hydrated);
  const note = useApp((s) => s.data.profile.goalNote);
  const [phase, setPhase] = useState<'logo' | 'note' | 'done'>('logo');

  useEffect(() => {
    if (!hydrated) return;
    const t1 = setTimeout(() => setPhase(note ? 'note' : 'done'), reduce ? 200 : LOGO_MS);
    const t2 = note ? setTimeout(() => setPhase('done'), (reduce ? 200 : LOGO_MS) + NOTE_MS) : undefined;
    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
    // Run once per launch, after the saved note is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="splash"
          role="presentation"
          data-splash
          onClick={() => setPhase('done')}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-8 text-center"
        >
          <motion.img
            src="/icon.svg"
            alt=""
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="size-20 rounded-[22px] shadow-[0_10px_30px_rgb(255_45_85/0.35)]"
          />
          <motion.div
            initial={reduce ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 text-title2 font-bold tracking-tight"
          >
            Repwise
          </motion.div>
          <AnimatePresence>
            {phase === 'note' && note && (
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 max-w-[30ch] text-title3 font-semibold leading-snug text-label"
              >
                <span className="mb-1 block text-footnote font-semibold uppercase tracking-wide text-pink">Your goal</span>
                {note}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}