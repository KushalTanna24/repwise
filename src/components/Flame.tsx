import { motion, useReducedMotion } from 'motion/react';

const OUTER = 'M12 1C13 7 20 10 20 20a8 8 0 0 1-16 0c0-5 3-8 4.5-10 0 3 1.5 5 3 5-1-5-.5-10 .5-14z';
const MIDDLE = 'M12 10c1 4 5 6 5 12a5 5 0 0 1-10 0c0-3 2-5 3-6 .5 2 1.5 3 2.5 3-.5-3-1-6-.5-9z';
const CORE = 'M12 19c1 2 3 3 3 6a3 3 0 0 1-6 0c0-2 2-4 3-6z';

/** The streak flame. Grey while today is pending; flickers only when asked (the ignite moment). */
export function Flame({ lit, size = 24, flicker = false }: { lit: boolean; size?: number; flicker?: boolean }) {
  const reduce = useReducedMotion();
  const live = flicker && !reduce;
  return (
    <svg width={(size * 24) / 32} height={size} viewBox="0 0 24 32" aria-hidden className={lit ? undefined : 'opacity-50'}>
      <motion.g
        style={{ transformOrigin: '12px 30px' }}
        animate={live ? { scaleY: [1, 1.06, 0.97, 1.04, 1], skewX: [0, -2, 1.5, -1, 0] } : undefined}
        transition={live ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <path d={OUTER} fill={lit ? '#FF9500' : '#C7C7CC'} />
        <path d={MIDDLE} fill={lit ? '#FF6B00' : '#AEAEB2'} />
        <path d={CORE} fill={lit ? '#FFD60A' : '#E5E5EA'} />
      </motion.g>
    </svg>
  );
}
