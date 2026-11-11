import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { AlertTriangle, CircleCheck, Info, PlayCircle, Plus } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { addNoteLine, exerciseNoteLines, updateNoteLine, type NoteField } from '@/domain/exerciseNotes';
import { GUIDES, demoUrl } from '@/domain/guides';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { act, useData } from '@/store/app';

/** Not routed: it stacks on top of the workout sheet without closing it. */
export const useGuide = create<{ id: string | null; notes?: boolean }>(() => ({ id: null }));
/** `notes` scrolls straight to the user's own cues. */
export const openGuide = (id: string, opts?: { notes?: boolean }) => useGuide.setState({ id, notes: !!opts?.notes });

export function GuideButton({ id, className }: { id: string; className?: string }) {
  if (!id) return null;
  return (
    <button
      aria-label="How to do this exercise"
      onClick={(e) => {
        e.stopPropagation();
        openGuide(id);
      }}
      className={`press grid size-8 shrink-0 place-items-center rounded-full text-blue ${className ?? ''}`}
    >
      <Info className="size-[20px]" />
    </button>
  );
}

function Section({ title, children, sectionRef }: { title: string; children: React.ReactNode; sectionRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={sectionRef} className="scroll-mt-4">
      <div className="px-4 pb-1.5 pt-5 text-footnote uppercase text-label-2">{title}</div>
      <Card className="p-4">{children}</Card>
    </div>
  );
}

type Kind = NoteField;

/** The bullet in front of a line: a number for steps, a check for cues, a warning for mistakes. */
function Marker({ kind, n, mine }: { kind: Kind; n: number; mine?: boolean }) {
  if (kind === 'steps')
    return (
      <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-footnote font-bold', mine ? 'bg-blue/15 text-blue' : 'bg-blue text-white')}>{n}</span>
    );
  if (kind === 'think') return <CircleCheck className="mt-0.5 size-5 shrink-0 text-green" />;
  return <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange" />;
}

const GAP: Record<Kind, string> = { steps: 'gap-3', think: 'gap-2.5', mistakes: 'gap-2.5' };

/** Single-line editor used both for adding and for fixing a bullet. Enter saves, Escape cancels. */
function LineInput({ initial, label, onSave, onDone }: { initial: string; label: string; onSave: (text: string) => void; onDone: () => void }) {
  const [text, setText] = useState(initial);
  const cancelled = useRef(false);
  return (
    <input
      autoFocus
      aria-label={label}
      value={text}
      enterKeyHint="done"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSave(text);
          setText('');
          if (initial) onDone();
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          cancelled.current = true;
          onDone();
        }
      }}
      onBlur={() => {
        if (!cancelled.current && text !== initial) onSave(text);
        onDone();
      }}
      className="min-w-0 flex-1 rounded-[8px] bg-fill px-2 py-0.5 text-body outline-none focus:ring-2 focus:ring-blue"
    />
  );
}

/** Built-in lines, then the user's own lines (tap to edit, clear to remove), then a + row. */
function GuideList({ exerciseId, kind, title, items }: { exerciseId: string; kind: Kind; title: string; items: string[] }) {
  const mine = exerciseNoteLines(useData(), exerciseId, kind);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const Tag = kind === 'steps' ? 'ol' : 'ul';
  const row = cn('flex text-body', GAP[kind]);

  return (
    <>
      <Tag className={cn('grid', kind === 'steps' ? 'gap-3' : 'gap-2')}>
        {items.map((s, i) => (
          <li key={`g${i}`} className={row}>
            <Marker kind={kind} n={i + 1} />
            <span>{s}</span>
          </li>
        ))}
        {mine.map((s, i) => (
          <li key={`m${i}-${s}`} className={row}>
            <Marker kind={kind} n={items.length + i + 1} mine />
            {editing === i ? (
              <LineInput
                initial={s}
                label={`Edit ${title.toLowerCase()} note`}
                onSave={(t) => act((d) => updateNoteLine(d, exerciseId, kind, i, t))}
                onDone={() => setEditing(null)}
              />
            ) : (
              <button onClick={() => setEditing(i)} className="min-w-0 flex-1 text-left" aria-label={`Edit note: ${s}`}>
                {s}
              </button>
            )}
          </li>
        ))}
        {editing === 'new' && (
          <li className={row}>
            <Marker kind={kind} n={items.length + mine.length + 1} mine />
            <LineInput
              initial=""
              label={`New ${title.toLowerCase()} note`}
              onSave={(t) => act((d) => addNoteLine(d, exerciseId, kind, t))}
              onDone={() => setEditing(null)}
            />
          </li>
        )}
      </Tag>
      {editing !== 'new' && (
        <button
          aria-label={`Add to ${title}`}
          onClick={() => setEditing('new')}
          className={cn('press flex w-full items-center gap-2.5 text-subhead font-semibold text-blue', items.length + mine.length > 0 && 'mt-3 border-t border-sep pt-3')}
        >
          <Plus className="size-5" strokeWidth={2.5} />
          {items.length + mine.length > 0 ? 'Add your own' : `Add ${title.toLowerCase()}`}
        </button>
      )}
    </>
  );
}

export function GuideSheet() {
  const id = useGuide((s) => s.id);
  const notes = useGuide((s) => !!s.notes);
  const data = useData();
  const ex = id ? getExercise(id, data.customExercises) : undefined;
  const g = id ? GUIDES[id] : undefined;
  const close = () => useGuide.setState({ id: null });
  const thinkRef = useRef<HTMLDivElement>(null);

  // "Add your notes" from a workout lands on the user's cues rather than the top of the guide.
  useEffect(() => {
    if (!id || !notes) return;
    const t = setTimeout(() => thinkRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350);
    return () => clearTimeout(t);
  }, [id, notes]);

  return (
    <Sheet open={!!id} onClose={close} tall title={ex?.name ?? 'How to'} right={<Button variant="plain" size="sm" className="font-bold" onClick={close}>Done</Button>}>
      {ex && (
        <div key={ex.id} className="pb-6">
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="rounded-full bg-blue/12 px-3 py-1 text-footnote font-semibold text-blue">{ex.muscle}</span>
            <span className="rounded-full bg-fill px-3 py-1 text-footnote font-semibold capitalize text-label-2">{ex.equipment}</span>
          </div>

          {g ? (
            <Section title="Setup">
              <p className="text-body">{g.setup}</p>
            </Section>
          ) : (
            <p className="px-1 pt-4 text-subhead text-label-2">This is your own exercise, so there's no written guide. Add your own steps and cues below, and the demo search usually finds a good one.</p>
          )}
          <Section title="Steps">
            <GuideList exerciseId={ex.id} kind="steps" title="Steps" items={g?.steps ?? []} />
          </Section>
          <Section title="Think about" sectionRef={thinkRef}>
            <GuideList exerciseId={ex.id} kind="think" title="Think about" items={g?.cues ?? []} />
          </Section>
          <Section title="Common mistakes">
            <GuideList exerciseId={ex.id} kind="mistakes" title="Common mistakes" items={g?.mistakes ?? []} />
          </Section>
          <p className="px-4 pt-1.5 text-footnote text-label-2">Your own cues and mistakes also show on this exercise during workouts.</p>

          <a href={demoUrl(ex.name)} target="_blank" rel="noreferrer" className="press mt-5 flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-red text-headline font-semibold text-white">
            <PlayCircle className="size-5" /> Watch a demo
          </a>
          <p className="px-2 pt-3 text-center text-footnote text-label-2">Start light and own the movement before adding weight. Stop if anything hurts.</p>
        </div>
      )}
    </Sheet>
  );
}
