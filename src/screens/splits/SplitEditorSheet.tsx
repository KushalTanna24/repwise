import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { addDay, moveDay, removeDay, saveCustomSplit, validateSplit } from '@/domain/training';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { List } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { closeSheet, openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act } from '@/store/app';
import { useSplitDraft } from '@/store/splitDraft';

const MAX_DAYS = 7;

export const INPUT = 'h-10 min-w-0 flex-1 rounded-[10px] bg-fill px-3 text-body outline-none focus:ring-2 focus:ring-blue';

/** Edits the draft split: name and days. Days open the day editor; nothing is stored until Save. */
export function SplitEditorSheet({ splitId, onClose }: { splitId: string | null; onClose: () => void }) {
  const draft = useSplitDraft((s) => s.draft);
  const dirty = useSplitDraft((s) => s.dirty);
  const edit = useSplitDraft((s) => s.edit);
  const leaving = useRef(false);
  const live = splitId !== null && draft?.id === splitId ? draft : null;

  // The draft is not persisted, so a reload leaves the route without one.
  useEffect(() => {
    if (splitId && !live && !leaving.current) closeSheet({ replace: true });
  }, [splitId, live]);
  useEffect(() => {
    if (splitId) leaving.current = false;
  }, [splitId]);

  async function close() {
    if (dirty) {
      const ok = await confirm({ title: 'Discard changes?', confirmLabel: 'Discard' });
      if (!ok) return;
    }
    leaving.current = true;
    useSplitDraft.getState().close();
    onClose();
  }

  function save() {
    if (!live) return;
    const problem = validateSplit(live);
    if (problem) return toast(problem);
    const now = new Date().toISOString();
    leaving.current = true;
    act((d) => saveCustomSplit(d, live, now));
    useSplitDraft.getState().close();
    openSheet('split', { replace: true });
    toast(`${live.name.trim()} saved`);
  }

  const days = live?.sessions ?? [];

  return (
    <Sheet
      open={!!live}
      onClose={close}
      title="Edit split"
      left={<Button variant="plain" size="sm" onClick={close}>Cancel</Button>}
      right={<Button size="sm" onClick={save}>Save</Button>}
    >
      {live && (
        <div className="grid gap-5">
          <label className="flex items-center gap-3">
            <span className="w-14 text-subhead text-label-2">Name</span>
            <input
              value={live.name}
              maxLength={40}
              onChange={(e) => edit((s) => ({ ...s, name: e.target.value }))}
              className={INPUT}
              aria-label="Split name"
            />
          </label>
          <div>
            <div className="px-4 pb-1.5 text-footnote uppercase text-label-2">Days</div>
            <List>
              {days.map((d, i) => (
                <div key={i} className="flex min-h-14 items-center gap-1 pl-4 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
                  <button onClick={() => openSheet(`split-day:${live.id}:${i}`)} className="press flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
                    <span className="w-4 text-subhead text-label-2 tabular">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body">{d.title || 'Untitled day'}</div>
                      <div className="text-footnote text-label-2">{d.slots.length} {d.slots.length === 1 ? 'exercise' : 'exercises'}</div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-label-3" strokeWidth={2.5} />
                  </button>
                  <button aria-label="Move day up" disabled={i === 0} onClick={() => edit((s) => moveDay(s, i, i - 1))} className="press grid size-9 place-items-center text-label-2 disabled:opacity-30">
                    <ArrowUp className="size-4" />
                  </button>
                  <button aria-label="Move day down" disabled={i === days.length - 1} onClick={() => edit((s) => moveDay(s, i, i + 1))} className="press grid size-9 place-items-center text-label-2 disabled:opacity-30">
                    <ArrowDown className="size-4" />
                  </button>
                  {days.length > 1 ? (
                    <Menu
                      label={`${d.title} options`}
                      trigger={
                        <button className="press grid size-10 place-items-center text-label-2">
                          <MoreHorizontal className="size-5" />
                        </button>
                      }
                      items={[{ label: 'Delete', icon: <Trash2 />, destructive: true, onSelect: () => edit((s) => removeDay(s, i)) }]}
                    />
                  ) : (
                    <span className="size-10" />
                  )}
                </div>
              ))}
            </List>
            {days.length < MAX_DAYS && (
              <Button variant="tinted" className="mt-3 w-full" onClick={() => edit(addDay)}>
                <Plus className="size-5" /> Add day
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
