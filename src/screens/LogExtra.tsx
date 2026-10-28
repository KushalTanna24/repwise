import { useState } from 'react';
import dayjs from 'dayjs';
import { Footprints, Sparkles, StretchHorizontal } from 'lucide-react';
import type { ExtraSession } from '@/domain/types';
import { parseNumber } from '@/domain/stats';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { FieldRow, TextInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { toast } from '@/lib/toast';
import { act } from '@/store/app';

const TYPES = [
  { value: 'run', label: 'Run', icon: Footprints },
  { value: 'mobility', label: 'Mobility', icon: StretchHorizontal },
  { value: 'skills', label: 'Skills', icon: Sparkles },
] as const;

/** Off-rotation activity. Never touches the split rotation. */
export function ExtraSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<ExtraSession['type']>('run');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const [note, setNote] = useState('');

  function save() {
    const m = parseNumber(minutes);
    const d = parseNumber(km);
    if (m == null && d == null && !note.trim()) return toast('Add a time, distance or note');
    const extra: ExtraSession = {
      id: crypto.randomUUID(),
      date,
      type,
      ...(m != null ? { minutes: m } : {}),
      ...(d != null && type === 'run' ? { distanceKm: d } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    act((x) => ({ ...x, extras: [...x.extras, extra] }));
    toast('Logged');
    setMinutes('');
    setKm('');
    setNote('');
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log extra"
      left={<Button variant="plain" size="sm" onClick={onClose}>Cancel</Button>}
      right={<Button variant="plain" size="sm" className="font-bold" onClick={save}>Save</Button>}
    >
      <Segmented value={type} onChange={setType} options={TYPES.map(({ value, label }) => ({ value, label }))} />
      <p className="px-1 pb-2 pt-3 text-footnote text-label-2">Extras show in History but don't move your split rotation.</p>
      <List>
        <FieldRow label="Date">
          <TextInput type="date" value={date} max={dayjs().format('YYYY-MM-DD')} onChange={(e) => setDate(e.target.value || date)} />
        </FieldRow>
        <FieldRow label="Minutes">
          <TextInput inputMode="decimal" placeholder="30" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-24" />
        </FieldRow>
        {type === 'run' && (
          <FieldRow label="Distance (km)">
            <TextInput inputMode="decimal" placeholder="5" value={km} onChange={(e) => setKm(e.target.value)} className="w-24" />
          </FieldRow>
        )}
        <FieldRow label="Note">
          <TextInput placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} className="w-44" />
        </FieldRow>
      </List>
    </Sheet>
  );
}
