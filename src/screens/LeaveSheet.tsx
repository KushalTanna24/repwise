import { useState } from 'react';
import dayjs from 'dayjs';
import { activeRuns } from '@/domain/challenges';
import { currentLeave, endLeave, MAX_BACKDATE_DAYS, startLeave } from '@/domain/leave';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List } from '@/components/ui/card';
import { FieldRow, Switch, TextInput } from '@/components/ui/field';
import { toast } from '@/lib/toast';
import { useToday } from '@/lib/useToday';
import { act, useData } from '@/store/app';
import { Done } from './profile/Done';

/** Planned time off: the streak pauses and reminders go quiet. */
export function LeaveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const cur = currentLeave(data, today);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(dayjs(today).add(7, 'day').format('YYYY-MM-DD'));
  const [openEnded, setOpenEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strict = activeRuns(data).filter((r) => r.rule === 'strict');

  function begin() {
    const r = startLeave(data, start, openEnded ? null : end, today);
    if ('error' in r) return setError(r.error);
    setError(null);
    act(() => r);
    toast('Leave on. Streak paused');
    onClose();
  }

  function finish() {
    act((d) => endLeave(d, today));
    toast('Welcome back. Today counts again');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Leave" right={<Done onClose={onClose} />}>
      {cur ? (
        <>
          <p className="px-4 pb-3 text-subhead text-label-2">
            On leave{cur.end ? ` until ${dayjs(cur.end).format('ddd D MMM')}` : ''}. Your streak is paused and reminders are quiet.
          </p>
          <Button className="w-full" onClick={finish}>
            End leave
          </Button>
        </>
      ) : (
        <>
          <p className="px-4 pb-3 text-subhead text-label-2">Your streak pauses and reminders go quiet. Workouts ease back in when you return.</p>
          <List>
            <FieldRow label="Starts">
              <TextInput
                type="date"
                value={start}
                min={dayjs(today).subtract(MAX_BACKDATE_DAYS, 'day').format('YYYY-MM-DD')}
                onChange={(e) => setStart(e.target.value || start)}
              />
            </FieldRow>
            <FieldRow label="Until I turn it off">
              <Switch label="Until I turn it off" checked={openEnded} onChange={setOpenEnded} />
            </FieldRow>
            {!openEnded && (
              <FieldRow label="Ends">
                <TextInput type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value || end)} />
              </FieldRow>
            )}
          </List>
          {error && <p className="px-4 pt-2 text-footnote text-red">{error}</p>}
          {strict.map((r) => (
            <p key={r.id} className="mx-1 mt-3 rounded-[10px] bg-orange/15 px-3 py-2 text-footnote font-semibold text-[#C93400]">
              Leave doesn't pause your {r.title}. Missed tasks still end it.
            </p>
          ))}
          <Button className="mt-3 w-full" onClick={begin}>
            Start leave
          </Button>
        </>
      )}
    </Sheet>
  );
}
