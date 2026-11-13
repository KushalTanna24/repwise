import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { BUILTIN_EXERCISES } from '@/domain/catalogue';
import { addCustomExercise, renameCustomExercise, setArchived, setExcluded } from '@/domain/library';
import type { EquipmentKind, Exercise, Pattern } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { FieldRow, Select, Switch, TextInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { Menu } from '@/components/ui/menu';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';

const PATTERNS: { value: Pattern; label: string }[] = [
  { value: 'knee', label: 'Squat / lunge' },
  { value: 'hip', label: 'Hinge / hamstrings' },
  { value: 'hpush', label: 'Chest press' },
  { value: 'vpush', label: 'Overhead press' },
  { value: 'hpull', label: 'Row' },
  { value: 'vpull', label: 'Pull-up / pulldown' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
];
const EQUIP: { value: EquipmentKind; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

export function LibrarySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const [tab, setTab] = useState<'all' | 'custom'>('all');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ name: '', pattern: 'hpull' as Pattern, equipment: 'cable' as EquipmentKind });

  const builtins = useMemo(() => {
    const n = q.trim().toLowerCase();
    return BUILTIN_EXERCISES.filter((e) => !n || `${e.name} ${e.muscle}`.toLowerCase().includes(n));
  }, [q]);

  function add() {
    if (!draft.name.trim()) return toast('Name the exercise');
    const kind: Exercise['kind'] = draft.equipment === 'bodyweight' ? 'bodyweight' : 'weighted';
    const muscle = PATTERNS.find((p) => p.value === draft.pattern)!.label;
    act((d) => addCustomExercise(d, { name: draft.name, pattern: draft.pattern, equipment: draft.equipment, kind, muscle }));
    toast(`${draft.name.trim()} added`);
    setDraft({ ...draft, name: '' });
  }

  function rename(e: Exercise) {
    const name = window.prompt('Rename exercise', e.name);
    if (name?.trim()) act((d) => renameCustomExercise(d, e.id, name));
  }

  return (
    <Sheet open={open} onClose={onClose} tall title="Exercise library" right={<Button variant="plain" size="sm" className="font-bold" onClick={onClose}>Done</Button>}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'Built-in' }, { value: 'custom', label: `Custom (${data.customExercises.length})` }]} />

      {tab === 'all' ? (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="mt-3 h-10 w-full rounded-[10px] bg-fill px-3 text-body outline-none placeholder:text-label-2"
          />
          <p className="px-4 pb-2 pt-3 text-footnote text-label-2">Turn off anything you can't or won't do. The planner picks the next option in that slot.</p>
          <List>
            {builtins.map((e) => (
              <FieldRow key={e.id} label={e.name} hint={`${e.muscle} · ${e.equipment}`}>
                <Switch label={`Use ${e.name}`} checked={!data.profile.excludedExerciseIds.includes(e.id)} onChange={(on) => act((d) => setExcluded(d, e.id, !on))} />
              </FieldRow>
            ))}
          </List>
        </>
      ) : (
        <>
          <div className="px-4 pb-2 pt-4 text-footnote uppercase text-label-2">New exercise</div>
          <List>
            <FieldRow label="Name">
              <TextInput placeholder="e.g. Landmine press" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-44" />
            </FieldRow>
            <FieldRow label="Movement">
              <Select label="Movement" value={draft.pattern} options={PATTERNS} onChange={(pattern) => setDraft({ ...draft, pattern })} />
            </FieldRow>
            <FieldRow label="Equipment">
              <Select label="Equipment" value={draft.equipment} options={EQUIP} onChange={(equipment) => setDraft({ ...draft, equipment })} />
            </FieldRow>
          </List>
          <Button className="mt-3 w-full" onClick={add}>
            <Plus className="size-4" strokeWidth={2.5} /> Add exercise
          </Button>
          <p className="px-4 pt-2 text-footnote text-label-2">Custom exercises show up when you add or swap during a workout.</p>

          {data.customExercises.length > 0 && (
            <>
              <div className="px-4 pb-2 pt-6 text-footnote uppercase text-label-2">Your exercises</div>
              <List>
                {data.customExercises.map((e) => {
                  const archived = data.archivedExerciseIds.includes(e.id);
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-2 py-2.5 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
                      <div className="min-w-0">
                        <div className={archived ? 'truncate text-body text-label-3' : 'truncate text-body'}>{e.name}</div>
                        <div className="text-footnote text-label-2">{archived ? 'Archived · history kept' : `${e.muscle} · ${e.equipment}`}</div>
                      </div>
                      <Menu
                        label={`${e.name} options`}
                        trigger={<Button variant="plain" size="sm">Edit</Button>}
                        items={[
                          { label: 'Rename', icon: <Pencil className="size-4" />, onSelect: () => rename(e) },
                          archived
                            ? { label: 'Restore', icon: <ArchiveRestore className="size-4" />, onSelect: () => act((d) => setArchived(d, e.id, false)) }
                            : { label: 'Archive', icon: <Archive className="size-4" />, onSelect: () => act((d) => setArchived(d, e.id, true)), destructive: true },
                        ]}
                      />
                    </div>
                  );
                })}
              </List>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
