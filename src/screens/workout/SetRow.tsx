import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Play, Square } from 'lucide-react';
import { heldSeconds } from '@/lib/alerts';
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
  exIdx: number;
  highlight?: boolean;
  /** Timed moves: seconds held, from the hold timer. */
  onHold: (sec: number) => void;
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

export function SetRow({ index, exIdx, highlight, onHold, set, ex, units, loadField, targetAssist, onPatch, onToggle, onSkip, onRemove }: Props) {
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

  // Hold timer for timed moves: ▶ starts, the row fills toward the target, tap again to log.
  const [holdStart, setHoldStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const target = set.targetReps ?? 30;
  const held = holdStart ? heldSeconds(holdStart, now) : 0;
  const buzzed = useRef(false);
  useEffect(() => {
    if (!holdStart) return;
    buzzed.current = false;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [holdStart]);
  useEffect(() => {
    if (holdStart && held >= target && !buzzed.current) {
      buzzed.current = true;
      navigator.vibrate?.([200, 80, 200]);
    }
  }, [held, holdStart, target]);

  function hold() {
    if (!holdStart) {
      navigator.vibrate?.(12);
      setNow(Date.now());
      setHoldStart(Date.now());
      return;
    }
    const sec = heldSeconds(holdStart, Date.now());
    setHoldStart(null);
    if (sec > 0) onHold(sec);
  }
  const holding = timed && !done && !skipped;

  return (
    <motion.div
      layout="position"
      data-set-row={`${exIdx}-${index}`}
      className={cn(
        'relative grid grid-cols-[36px_1fr_1fr_44px] items-center gap-2 overflow-hidden rounded-[12px] px-1 py-1 transition-colors',
        done && 'bg-green/12',
        skipped && 'opacity-45',
        highlight && 'ring-2 ring-blue',
      )}
    >
      {holdStart && (
        <div
          aria-hidden
          className={cn('absolute inset-y-0 left-0 transition-[width] duration-200 ease-linear', held >= target ? 'bg-green/20' : 'bg-blue/15')}
          style={{ width: `${Math.min(100, (held / target) * 100)}%` }}
        />
      )}
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
      {holdStart ? (
        <div className="relative text-center text-title3 font-bold tabular" aria-live="polite">
          {held}
          <span className="text-footnote font-semibold text-label-2"> / {target}s</span>
        </div>
      ) : (
        <NumberCell
          label={`Set ${index + 1} ${timed ? 'seconds' : 'reps'}`}
          value={set.actualReps}
          placeholder={set.targetReps != null ? String(set.targetReps) : '–'}
          disabled={skipped}
          onCommit={(n) => onPatch({ actualReps: n == null ? null : Math.round(n) })}
        />
      )}
      {holding ? (
        <button
          onClick={hold}
          aria-label={holdStart ? `Stop hold and log set ${index + 1}` : `Start hold timer for set ${index + 1}`}
          className={cn('press relative grid size-10 place-items-center justify-self-end rounded-full text-white', holdStart ? 'bg-orange' : 'bg-blue')}
        >
          {holdStart ? <Square className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
        </button>
      ) : (
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
      )}
    </motion.div>
  );
}
