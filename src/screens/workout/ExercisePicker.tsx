import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { allExercises } from '@/domain/catalogue';
import { isEligible } from '@/domain/planner';
import type { AppData, Exercise, Pattern } from '@/domain/types';
import { List, Row } from '@/components/ui/card';

const GROUP_LABEL: Record<Pattern | 'calisthenics', string> = {
  calisthenics: 'Calisthenics',
  knee: 'Squat & lunge',
  hip: 'Hinge & hamstrings',
  hpush: 'Chest press',
  vpush: 'Overhead press',
  hpull: 'Rows',
  vpull: 'Pull-ups & pulldowns',
  shoulders: 'Shoulders',
  arms: 'Arms',
  calves: 'Calves',
  core: 'Core',
};

interface Props {
  data: AppData;
  /** Shown first, e.g. same-slot swaps. */
  suggested?: Exercise[];
  onPick: (id: string) => void;
}

export function ExercisePicker({ data, suggested = [], onPick }: Props) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = allExercises(data).filter((e) => isEligible(e, data) && (!needle || `${e.name} ${e.muscle}`.toLowerCase().includes(needle)));
    // Calisthenics first so skill work is easy to find; the Map keeps insertion order.
    const by = new Map<Pattern | 'calisthenics', Exercise[]>([['calisthenics', []]]);
    for (const e of list) {
      const k = e.calisthenics ? 'calisthenics' : e.pattern;
      by.set(k, [...(by.get(k) ?? []), e]);
    }
    if (!by.get('calisthenics')!.length) by.delete('calisthenics');
    return [...by.entries()];
  }, [data, q]);

  return (
    <div>
      <label className="flex h-10 items-center gap-2 rounded-[10px] bg-fill px-3">
        <Search className="size-4 text-label-2" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises"
          className="flex-1 bg-transparent text-body outline-none placeholder:text-label-2"
        />
      </label>
      {!q && suggested.length > 0 && (
        <>
          <div className="px-4 pb-1.5 pt-5 text-footnote uppercase text-label-2">Same movement</div>
          <List>
            {suggested.map((e) => (
              <Row key={e.id} title={e.name} subtitle={e.muscle} onClick={() => onPick(e.id)} chevron />
            ))}
          </List>
        </>
      )}
      {groups.map(([pattern, list]) => (
        <div key={pattern}>
          <div className="px-4 pb-1.5 pt-5 text-footnote uppercase text-label-2">{GROUP_LABEL[pattern]}</div>
          <List>
            {list.map((e) => (
              <Row key={e.id} title={e.name} subtitle={`${e.muscle}${e.custom ? ' · custom' : ''}`} onClick={() => onPick(e.id)} chevron />
            ))}
          </List>
        </div>
      ))}
      {groups.length === 0 && <p className="py-10 text-center text-subhead text-label-2">No exercises match. Add your own in Profile → Exercise library.</p>}
    </div>
  );
}
