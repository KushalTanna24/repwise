import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, className }: Props<T>) {
  const id = useId();
  return (
    <div role="tablist" className={cn('flex rounded-[9px] bg-fill p-[2px]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className="relative h-8 flex-1 text-footnote font-semibold"
        >
          {o.value === value && (
            <motion.span
              layoutId={id}
              className="absolute inset-0 rounded-[7px] bg-card shadow-thumb"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
