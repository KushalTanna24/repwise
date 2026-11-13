import { useState } from 'react';
import dayjs from 'dayjs';
import { addGoal, removeGoal } from '@/domain/calendar';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { FieldRow, TextInput } from '@/components/ui/field';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';
import { Done } from './Done';

export function GoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayjs().add(3, 'month').format('YYYY-MM-DD'));
  function add() {
    if (!title.trim()) return toast('Name the goal');
    act((d) => addGoal(d, title, date));
    setTitle('');
    toast('Goal added to your calendar');
  }
  return (
    <Sheet open={open} onClose={onClose} tall title="Goals" right={<Done onClose={onClose} />}>
      {data.goals.length > 0 && (
        <List className="mb-3">
          {data.goals.map((g) => (
            <div key={g.id} className="flex items-center gap-2 py-2.5 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
              <div className="min-w-0 flex-1">
                <div className="truncate text-body">{g.title}</div>
                <div className="text-footnote text-label-2">
                  {dayjs(g.date).format('ddd D MMM YYYY')}
                  {g.date >= dayjs().format('YYYY-MM-DD') ? ` · ${dayjs(g.date).diff(dayjs().startOf('day'), 'day')} days left` : ' · past'}
                </div>
              </div>
              <Button variant="plain" size="sm" className="text-red" onClick={() => act((d) => removeGoal(d, g.id))}>
                Remove
              </Button>
            </div>
          ))}
        </List>
      )}
      <List>
        <FieldRow label="Goal">
          <TextInput placeholder="e.g. Bench 100 kg" value={title} onChange={(e) => setTitle(e.target.value)} className="w-44" />
        </FieldRow>
        <FieldRow label="Target date">
          <TextInput type="date" value={date} min={dayjs().format('YYYY-MM-DD')} onChange={(e) => setDate(e.target.value || date)} />
        </FieldRow>
      </List>
      <Button className="mt-3 w-full" onClick={add}>
        Add goal
      </Button>
      <p className="px-4 pt-2 text-footnote text-label-2">Goal dates are flagged on the History calendar with a countdown.</p>
    </Sheet>
  );
}
