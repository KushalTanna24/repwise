import { AnimatePresence, motion } from 'motion/react';
import { useToast } from '@/lib/toast';

export function Toaster() {
  const { text, id } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[80] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {text && (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-full bg-label/90 px-4 py-2.5 text-subhead font-medium text-white shadow-lg backdrop-blur-xl"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
