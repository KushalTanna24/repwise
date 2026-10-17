import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { fromDisplay, parseNumber, toDisplay } from '@/domain/stats';
import type { Exercise, SetRecord } from '@/domain/types';
import { Menu } from '@/components/ui/menu';
import { cn } from '@/lib/cn';

interface Props {
  index: number;
  set: SetRecord;
  ex: Exercise | undefined;
  units: 'kg' | 'lb';
  /** Which load column this exercise shows. */
  loadField: 'actualKg' | 'assistKg' | null;
  targetAssist: number | null;
  onPatch: (patch: Partial<SetRecord>) => void;
  onToggle: () => boolean;
  onSkip: () => void;
  onRemove: () => void;
}

/**
 * Text state is kept locally so "62." can be typed; the store only ever
 * receives parsed numbers (or null when the field is cleared).
 */
export function NumberCell({
  value,
  placeholder,
  onCommit,
  label,
  disabled,
  inputRef,
}: {
  value: number | null | undefined;
  placeholder: string;
  onCommit: (n: number | null) => void;
  label: string;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if (parseNumber(text) !== (value ?? null)) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      ref={inputRef}
      aria-label={label}
      inputMode="decimal"
      enterKeyHint="next"
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value);
        onCommit(parseNumber(e.target.value));
      }}
      className="h-10 w-full min-w-0 rounded-[10px] bg-fill text-center text-body font-semibold tabular outline-none placeholder:font-medium placeholder:text-label-3 focus:bg-blue/10 focus:ring-2 focus:ring-blue disabled:bg-transparent"
    />
  );
}

export function SetRow({ index, set, ex, units, loadField, targetAssist, onPatch, onToggle, onSkip, onRemove }: Props) {
  const done = set.status === 'done';
  const skipped = set.status === 'skipped';
  const loadRef = useRef<HTMLInputElement>(null);
  const timed = ex?.kind === 'timed';

  const loadValue = loadField ? set[loadField] : null;
  const loadTarget = loadField === 'assistKg' ? targetAssist : set.targetKg;
  const shown = (kg: number | null | undefined) => (kg == null ? null : toDisplay(kg, units));
  const loadPlaceholder = loadTarget != null ? String(toDisplay(loadTarget, units)) : ex?.kind === 'bodyweight' ? '0' : '–';

  function toggle() {
    navigator.vibrate?.(12);
    if (!onToggle()) loadRef.current?.focus();
  }

  return (
    <motion.div
      layout="position"
      className={cn(
        'grid grid-cols-[36px_1fr_1fr_44px] items-center gap-2 rounded-[12px] px-1 py-1 transition-colors',
        done && 'bg-green/12',
        skipped && 'opacity-45',
      )}
    >
      <Menu
        label={`Set ${index + 1} options`}
        trigger={
          <button className={cn('grid h-8 place-items-center rounded-full text-subhead font-bold tabular', done ? 'text-green' : 'text-label-2', skipped && 'line-through')}>
            {index + 1}
          </button>
        }
        items={[
          { label: skipped ? 'Set is skipped' : 'Skip set', onSelect: onSkip, disabled: skipped || done },
          { label: 'Remove set', onSelect: onRemove, destructive: true, disabled: done },
        ]}
      />
      {loadField ? (
        <NumberCell
          inputRef={loadRef}
          label={`Set ${index + 1} ${loadField === 'assistKg' ? 'assistance' : 'load'}`}
          value={shown(loadValue)}
          placeholder={loadPlaceholder}
          disabled={skipped}
          onCommit={(n) => onPatch({ [loadField]: n == null ? null : fromDisplay(n, units) })}
        />
      ) : (
        <div className="text-center text-footnote text-label-3">—</div>
      )}
      <NumberCell
        label={`Set ${index + 1} ${timed ? 'seconds' : 'reps'}`}
        value={set.actualReps}
        placeholder={set.targetReps != null ? String(set.targetReps) : '–'}
        disabled={skipped}
        onCommit={(n) => onPatch({ actualReps: n == null ? null : Math.round(n) })}
      />
      <button
        onClick={toggle}
        disabled={skipped}
        aria-pressed={done}
        aria-label={done ? `Undo set ${index + 1}` : `Complete set ${index + 1}`}
        className={cn(
          'press grid size-10 place-items-center justify-self-end rounded-full transition-colors',
          done ? 'bg-green text-white' : 'bg-fill text-label-3',
        )}
      >
        <motion.span key={String(done)} initial={done ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
          <Check className="size-5" strokeWidth={3} />
        </motion.span>
      </button>
    </motion.div>
  );
}
