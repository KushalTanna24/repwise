import { motion, useReducedMotion } from 'motion/react';

export interface Ring {
  value: number;
  max: number;
  color: string;
  label: string;
}

/** Concentric activity-style rings. Each ring fills to value/max, capped at one lap. */
export function Rings({ rings, size = 120, stroke = 14 }: { rings: Ring[]; size?: number; stroke?: number }) {
  const reduce = useReducedMotion();
  const gap = 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map((r) => `${r.label} ${r.value} of ${r.max}`).join(', ')}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        const pct = r.max > 0 ? Math.min(1, r.value / r.max) : 0;
        return (
          <g key={r.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.18} strokeWidth={stroke} />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={r.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              initial={{ pathLength: reduce ? pct : 0 }}
              animate={{ pathLength: pct }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
              style={{ opacity: pct === 0 ? 0 : 1 }}
            />
          </g>
        );
      })}
    </svg>
  );
}
