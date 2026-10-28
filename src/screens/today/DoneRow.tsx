import { useEffect, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

/** Slim green row for a card whose job for today is finished. Tap to reopen it. */
export function DoneRow({ label, detail, onOpen }: { label: string; detail: string; onOpen: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onOpen}
      aria-label={`${label} done: ${detail}. Tap to open`}
      className="press mt-3 flex w-full items-center gap-3 rounded-card bg-green p-3 pl-4 text-left text-white shadow-card"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20">
        <Check className="size-5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-footnote font-semibold uppercase tracking-wide text-white/80">{label}</div>
        <div className="truncate text-headline font-semibold tabular">{detail}</div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-white/70" />
    </motion.button>
  );
}

/** Collapsed while done; reopening sticks until the card is done again. */
export function useDoneCollapse(done: boolean): [collapsed: boolean, open: () => void, close: () => void] {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (done) setOpened(false);
  }, [done]);
  return [done && !opened, () => setOpened(true), () => setOpened(false)];
}
