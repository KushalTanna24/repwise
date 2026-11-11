import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { AlertTriangle, CircleCheck, Info, NotebookPen, PlayCircle } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { setExerciseNote, type NoteField } from '@/domain/exerciseNotes';
import { GUIDES, demoUrl } from '@/domain/guides';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { act, useData } from '@/store/app';

/** Not routed: it stacks on top of the workout sheet without closing it. */
export const useGuide = create<{ id: string | null; notes?: boolean }>(() => ({ id: null }));
/** `notes` opens straight into the user's own notes. */
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="px-4 pb-1.5 pt-5 text-footnote uppercase text-label-2">{title}</div>
      <Card className="p-4">{children}</Card>
      {hint && <p className="px-4 pt-1.5 text-footnote text-label-2">{hint}</p>}
    </>
  );
}

/** One personal note. Saves on blur and when the sheet closes, never per keystroke. */
function NoteInput({ exerciseId, field, label, placeholder, icon }: { exerciseId: string; field: NoteField; label: string; placeholder: string; icon: React.ReactNode }) {
  const saved = useData().exerciseNotes[exerciseId]?.[field] ?? '';
  const [text, setText] = useState(saved);
  const latest = useRef(text);
  latest.current = text;
  useEffect(() => setText(saved), [saved]);
  useEffect(() => () => act((d) => setExerciseNote(d, exerciseId, field, latest.current)), [exerciseId, field]);
  return (
    <label className="block">
      <div className="flex items-center gap-2 text-subhead font-semibold">
        {icon}
        {label}
      </div>
      <textarea
        rows={3}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => act((d) => setExerciseNote(d, exerciseId, field, text))}
        className="mt-2 w-full resize-none rounded-[10px] bg-fill px-3 py-2 text-body outline-none placeholder:text-label-3 focus:ring-2 focus:ring-blue"
      />
    </label>
  );
}

/** Folded to one row until the user has notes or asked to write some, so the guide stays first. */
function MyNotes({ exerciseId, startOpen }: { exerciseId: string; startOpen: boolean }) {
  const has = !!useData().exerciseNotes[exerciseId];
  const [open, setOpen] = useState(has || startOpen);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="press mt-4 flex w-full items-center gap-3 rounded-card bg-card px-4 py-3 text-left shadow-card">
        <NotebookPen className="size-5 shrink-0 text-blue" />
        <span className="flex-1">
          <span className="block text-body font-semibold text-blue">Add your own notes</span>
          <span className="block text-footnote text-label-2">Your cues and the mistakes you make, shown during workouts</span>
        </span>
      </button>
    );
  return (
    <Section title="Your notes" hint="One per line. They show on this exercise during your workout.">
      <div className="grid gap-4">
        <NoteInput
          exerciseId={exerciseId}
          field="think"
          label="Think about"
          placeholder="e.g. Pin shoulder blades before unracking"
          icon={<CircleCheck className="size-5 text-green" />}
        />
        <NoteInput
          exerciseId={exerciseId}
          field="mistakes"
          label="Mistakes I make"
          placeholder="e.g. Rushing the last two reps"
          icon={<AlertTriangle className="size-5 text-orange" />}
        />
      </div>
    </Section>
  );
}

export function GuideSheet() {
  const id = useGuide((s) => s.id);
  const notes = useGuide((s) => !!s.notes);
  const data = useData();
  const ex = id ? getExercise(id, data.customExercises) : undefined;
  const g = id ? GUIDES[id] : undefined;
  const close = () => useGuide.setState({ id: null });

  return (
    <Sheet open={!!id} onClose={close} tall title={ex?.name ?? 'How to'} right={<Button variant="plain" size="sm" className="font-bold" onClick={close}>Done</Button>}>
      {ex && (
        <div className="pb-6">
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="rounded-full bg-blue/12 px-3 py-1 text-footnote font-semibold text-blue">{ex.muscle}</span>
            <span className="rounded-full bg-fill px-3 py-1 text-footnote font-semibold capitalize text-label-2">{ex.equipment}</span>
          </div>

          <MyNotes key={ex.id} exerciseId={ex.id} startOpen={notes} />

          {g ? (
            <>
              <Section title="Setup">
                <p className="text-body">{g.setup}</p>
              </Section>
              <Section title="Steps">
                <ol className="grid gap-3">
                  {g.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-body">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue text-footnote font-bold text-white">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </Section>
              <Section title="Think about">
                <ul className="grid gap-2">
                  {g.cues.map((c) => (
                    <li key={c} className="flex gap-2.5 text-body">
                      <CircleCheck className="mt-0.5 size-5 shrink-0 text-green" />
                      {c}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Common mistakes">
                <ul className="grid gap-2">
                  {g.mistakes.map((m) => (
                    <li key={m} className="flex gap-2.5 text-body">
                      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange" />
                      {m}
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          ) : (
            <p className="px-1 pt-4 text-subhead text-label-2">This is your own exercise, so there's no written guide. The demo search below usually finds a good one.</p>
          )}

          <a href={demoUrl(ex.name)} target="_blank" rel="noreferrer" className="press mt-5 flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-red text-headline font-semibold text-white">
            <PlayCircle className="size-5" /> Watch a demo
          </a>
          <p className="px-2 pt-3 text-center text-footnote text-label-2">Start light and own the movement before adding weight. Stop if anything hurts.</p>
        </div>
      )}
    </Sheet>
  );
}
