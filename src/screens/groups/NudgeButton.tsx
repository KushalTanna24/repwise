import { useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List, Row, SectionHeader } from '@/components/ui/card';
import { FieldRow, TextInput } from '@/components/ui/field';
import { NOTE_MAX, PRESETS, useSendNudge, useSentToday, type Delivery, type PresetId } from '@/lib/groups';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/cn';

const SENT: Record<Delivery, string> = {
  push: 'Nudge sent',
  cheer: 'They already trained today. Cheer sent.',
  quiet: "Sent. They'll see it when they open Repwise.",
  capped: "Sent. They'll see it in the app.",
};

/** One tap opens a short list of lines; one more sends. Disabled once you've nudged them today. */
export function NudgeButton({ groupId, userId, name, size = 'sm', className }: { groupId: string; userId: string; name: string; size?: 'sm' | 'lg'; className?: string }) {
  const sentToday = useSentToday().data?.has(userId) ?? false;
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetId>('keep');
  const [note, setNote] = useState('');
  const send = useSendNudge();

  async function submit() {
    try {
      const delivery = await send.mutateAsync({ group: groupId, to: userId, ...(note.trim() ? { note: note.trim() } : { preset }) });
      toast(SENT[delivery]);
      setOpen(false);
      setNote('');
    } catch (e) {
      toast((e as Error).message || "Couldn't send the nudge. Try again.");
    }
  }

  return (
    <>
      <Button
        variant={sentToday ? 'gray' : 'tinted'}
        size={size}
        className={cn('shrink-0', className)}
        disabled={sentToday}
        aria-label={sentToday ? `Already nudged ${name} today` : `Nudge ${name}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {sentToday ? <Check className="mr-1 size-4" /> : <BellRing className="mr-1 size-4" />}
        {sentToday ? 'Nudged today' : 'Nudge'}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Nudge ${name}`}
        left={<Button variant="plain" size="sm" className="-ml-2" onClick={() => setOpen(false)}>Cancel</Button>}
      >
        <div className="pb-4">
          <List>
            {(Object.keys(PRESETS) as PresetId[]).map((id) => (
              <Row
                key={id}
                title={PRESETS[id]}
                onClick={() => (setPreset(id), setNote(''))}
                leading={<span className="w-4 pl-4">{!note.trim() && preset === id && <Check className="size-4 text-blue" strokeWidth={3} />}</span>}
              />
            ))}
          </List>
          <SectionHeader title="Or write your own" />
          <List>
            <FieldRow label="Note">
              <TextInput
                value={note}
                maxLength={NOTE_MAX}
                placeholder="Gym at 6 tomorrow?"
                onChange={(e) => setNote(e.target.value)}
                className="w-48"
                aria-label="Your note"
              />
            </FieldRow>
          </List>
          <p className="mt-1 px-1 text-right text-caption tabular text-label-2">{note.length}/{NOTE_MAX}</p>
          <Button size="lg" className="mt-3" disabled={send.isPending} onClick={() => void submit()}>
            {send.isPending ? 'Sending…' : 'Send nudge'}
          </Button>
          <p className="mt-2 px-1 text-footnote text-label-2">One nudge a day each. Late at night it waits quietly until they open the app.</p>
        </div>
      </Sheet>
    </>
  );
}
