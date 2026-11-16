import { useMemo, useState } from 'react';
import { Check, ChevronRight, Info, Link2 } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import {
  PRO_CATEGORY_LABEL,
  PRO_SPLITS,
  adoptProSplit,
  adoptedCopy,
  getProSplit,
  getSplit,
  saveCustomSplit,
  setSplit,
  validateSplit,
  type ProCategory,
  type ProSession,
  type ProSplit,
} from '@/domain/training';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List, Row, SectionHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';
import { useSplitDraft } from '@/store/splitDraft';

const TINT: Record<ProCategory, string> = {
  bodybuilder: 'bg-orange/15 text-orange',
  hollywood: 'bg-purple/15 text-purple',
  athlete: 'bg-teal/15 text-teal',
};

const initials = (person: string) =>
  person
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

function Avatar({ pro, size = 'md' }: { pro: ProSplit; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full font-bold', TINT[pro.category], size === 'lg' ? 'size-16 text-title2' : 'size-11 text-headline')}
    >
      {initials(pro.person)}
    </span>
  );
}

type Filter = 'all' | ProCategory;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(PRO_CATEGORY_LABEL) as ProCategory[]).map((c) => ({ value: c, label: PRO_CATEGORY_LABEL[c] })),
];

/** Entry card for the split chooser: one tap into the pro library. */
export function ProSplitsEntry() {
  const names = PRO_SPLITS.slice(0, 3).map((p) => p.person.split(' ').pop());
  return (
    <button onClick={() => openSheet('pros')} className="press flex w-full items-center gap-3 rounded-card bg-card p-4 text-left shadow-card">
      <span className="flex -space-x-3">
        {PRO_SPLITS.slice(0, 3).map((p) => (
          <span key={p.id} className="rounded-full ring-2 ring-card">
            <Avatar pro={p} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold">Pro splits</span>
        <span className="block text-footnote text-label-2">
          Train like {names.join(', ')} and {PRO_SPLITS.length - 3} more
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-label-3" />
    </button>
  );
}

/** The library: famous lifters' routines, filterable by who they are. */
export function ProSplitsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const [filter, setFilter] = useState<Filter>('all');
  const list = PRO_SPLITS.filter((p) => filter === 'all' || p.category === filter);

  return (
    <Sheet open={open} onClose={onClose} tall title="Pro splits" right={<Button variant="plain" size="sm" onClick={onClose}>Done</Button>}>
      <p className="mb-3 px-1 text-subhead text-label-2">How famous lifters split their week. Copy one and Repwise fits it to your equipment and session length.</p>
      <Segmented value={filter} options={FILTERS} onChange={setFilter} className="mb-4" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {list.map((p) => {
          const copy = adoptedCopy(data, p);
          const training = !!copy && data.program.splitId === copy.id;
          return (
            <button key={p.id} onClick={() => openSheet(`pro:${p.id}`)} className="press w-full rounded-card bg-card p-4 text-left shadow-card">
              <div className="flex items-start gap-3">
                <Avatar pro={p} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-headline font-semibold">{p.person}</div>
                  <div className="truncate text-footnote text-label-2">
                    {p.title} · {p.era}
                  </div>
                </div>
                {copy && (
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold', training ? 'bg-blue text-white' : 'bg-fill text-label-2')}>
                    {training ? 'Training' : 'In your splits'}
                  </span>
                )}
              </div>
              <div className="mt-3 text-subhead font-semibold">{p.name}</div>
              <p className="mt-0.5 text-subhead text-label-2">{p.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-fill px-2.5 py-1 text-caption font-semibold text-label">{p.daysPerWeek}×/wk</span>
                {p.sessions.map((s, i) => (
                  <span key={i} className="rounded-full bg-fill px-2.5 py-1 text-caption font-semibold text-label-2">
                    {s.title}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <p className="px-1 pt-4 text-footnote text-label-2">
        Rebuilt from books, interviews and training videos. Routines change over a career, so these are close readings, not official programs. Not affiliated with
        or endorsed by anyone listed.
      </p>
    </Sheet>
  );
}

/** Superset pairs on a day, labelled A, B, C so each pair reads as one block. */
function supersetLabels(day: ProSession): Map<string, string> {
  const out = new Map<string, string>();
  (day.supersets ?? []).forEach(([a, b], i) => {
    const letter = String.fromCharCode(65 + i);
    out.set(a, `${letter}1`);
    out.set(b, `${letter}2`);
  });
  return out;
}

export function ProSplitSheet({ proId, onClose }: { proId: string | null; onClose: () => void }) {
  const data = useData();
  const pro = proId ? getProSplit(proId) : undefined;
  const [now] = useState(() => new Date().toISOString());
  // Depends only on what shapes the fit; `data` changes on every store write.
  const fitted = useMemo(
    () => (pro ? adoptProSplit(data, pro, now, { fit: true }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pro, now, data.profile.equipment, data.profile.sessionMinutes, data.profile.daysPerWeek, data.profile.excludedExerciseIds, data.archivedExerciseIds, data.customExercises],
  );

  const copy = pro ? adoptedCopy(data, pro) : undefined;
  const training = !!copy && data.program.splitId === copy.id;
  // Every exercise on a day can drop out with very little equipment.
  const broken = !copy && !!fitted && validateSplit(fitted.split) !== null;
  const name = (id: string) => getExercise(id, data.customExercises)?.name ?? id;

  async function train() {
    if (!pro || !fitted || broken) return;
    if (data.activeSession) return toast('Finish or discard your workout first');
    const current = data.program.splitId ? getSplit(data, data.program.splitId) : undefined;
    const target = copy ?? fitted.split;
    if (current && current.id !== target.id) {
      const ok = await confirm({
        title: `Switch to ${target.name}?`,
        message: `${copy ? 'Your copy picks up where you left it.' : 'It is saved to your splits.'} Your history stays, and ${current.name} keeps its place if you switch back.`,
        confirmLabel: 'Switch',
      });
      if (!ok) return;
    }
    const stamp = new Date().toISOString();
    act((d) => setSplit(copy ? d : saveCustomSplit(d, fitted.split, stamp), target.id));
    toast(`${target.name} it is`);
    openSheet('split', { replace: true });
  }

  function copyAndEdit() {
    if (!pro) return;
    const { split } = adoptProSplit(data, pro, new Date().toISOString(), { fit: false });
    useSplitDraft.getState().open(split);
    openSheet(`split-edit:${split.id}`, { replace: true });
  }

  return (
    <Sheet open={!!pro} onClose={onClose} tall title={pro?.name} right={<Button variant="plain" size="sm" onClick={onClose}>Done</Button>}>
      {pro && fitted && (
        <>
          <div className="flex items-center gap-4 px-1 pt-2">
            <Avatar pro={pro} size="lg" />
            <div className="min-w-0">
              <div className="text-title2 font-bold">{pro.person}</div>
              <div className="text-subhead text-label-2">
                {pro.title} · {pro.era}
              </div>
            </div>
          </div>
          <p className="mt-3 px-1 text-body">{pro.tagline}</p>

          <SectionHeader title="How they trained" />
          <List>
            <Row title={<span className="whitespace-normal">{pro.schedule}</span>} />
            {pro.techniques.map((t) => (
              <Row key={t} title={<span className="whitespace-normal">{t}</span>} />
            ))}
          </List>

          {pro.sessions.map((day, i) => {
            const labels = supersetLabels(day);
            return (
              <div key={i}>
                <SectionHeader title={`Day ${i + 1} · ${day.title}`} />
                <List>
                  {day.slots.map((slot) => (
                    <Row
                      key={slot.id}
                      leading={
                        labels.has(slot.id) ? (
                          <span className="grid h-6 min-w-8 place-items-center rounded-full bg-pink/15 px-1.5 text-caption font-bold text-pink tabular">{labels.get(slot.id)}</span>
                        ) : undefined
                      }
                      title={name(slot.candidates[0])}
                      value={slot.role === 'anchor' ? 'Main' : undefined}
                    />
                  ))}
                </List>
                {labels.size > 0 && (
                  <p className="flex items-center gap-1 px-4 pt-1.5 text-footnote text-label-2">
                    <Link2 className="size-3.5" /> Same letter: superset, done back to back.
                  </p>
                )}
              </div>
            );
          })}

          <SectionHeader title="Fitted to you" />
          <List>
            {fitted.changes.length ? (
              fitted.changes.map((c) => <Row key={c} title={<span className="whitespace-normal">{c}</span>} />)
            ) : (
              <Row
                leading={<Check className="size-5 text-green" strokeWidth={3} />}
                title={<span className="whitespace-normal">Nothing to change. Your equipment covers every exercise and each day fits {data.profile.sessionMinutes} min.</span>}
              />
            )}
            <Row title={<span className="whitespace-normal text-label-2">Sets, reps and weights follow your goal and history, so progress tracks like any other split.</span>} />
          </List>

          <p className="flex gap-1.5 px-4 pt-3 text-footnote text-label-2">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {pro.source}
              {pro.inspired ? ' Reports vary, so this is inspired by their training rather than an exact copy.' : ''}
            </span>
          </p>

          <div className="mt-6 grid gap-2">
            <Button size="lg" onClick={train} disabled={training || broken}>
              {training ? 'You are training this' : broken ? 'Needs more equipment' : copy ? 'Switch to your copy' : 'Train this split'}
            </Button>
            <Button variant="plain" onClick={copyAndEdit}>
              Copy and edit first
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
