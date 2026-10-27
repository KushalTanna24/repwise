import { GOAL_LABEL, type GoalKind } from '@/domain/goals';
import { cn } from '@/lib/cn';

/** One chip per goal kind seen; new trackers get a chip by joining the registry. */
export function FilterChips({ kinds, value, onChange }: { kinds: GoalKind[]; value: GoalKind | null; onChange: (k: GoalKind | null) => void }) {
  if (kinds.length < 2) return null;
  const chip = (k: GoalKind | null, label: string) => (
    <button
      key={label}
      aria-pressed={value === k}
      onClick={() => onChange(k)}
      className={cn('press shrink-0 rounded-full px-3 py-1.5 text-footnote font-semibold', value === k ? 'bg-label text-white' : 'bg-card text-label shadow-card')}
    >
      {label}
    </button>
  );
  return (
    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Show on calendar">
      {chip(null, 'All')}
      {kinds.map((k) => chip(k, GOAL_LABEL[k]))}
    </div>
  );
}
