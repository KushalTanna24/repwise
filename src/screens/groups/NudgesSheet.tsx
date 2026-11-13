import { useEffect } from 'react';
import dayjs from 'dayjs';
import { BellRing, PartyPopper } from 'lucide-react';
import '@/lib/fmt';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, Empty, List, Row } from '@/components/ui/card';
import { PRESETS, useMarkNudgesRead, useNudges, type Nudge } from '@/lib/groups';
import { cn } from '@/lib/cn';

const line = (n: Nudge) => (n.delivery === 'cheer' && !n.note ? `cheered you on: ${n.preset ? PRESETS[n.preset] : ''}` : (n.note ?? (n.preset ? PRESETS[n.preset] : '')));

/** Nudges you received, newest first. Opening the list marks them read. */
export function NudgesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useNudges();
  const markRead = useMarkNudgesRead();
  const unread = q.unreadCount;

  useEffect(() => {
    if (open && unread > 0 && !markRead.isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unread]);

  return (
    <Sheet open={open} onClose={onClose} title="Nudges" right={<Button variant="plain" size="sm" className="font-bold" onClick={onClose}>Done</Button>}>
      <div className="pb-4">
        {q.isPending ? (
          <p className="py-10 text-center text-subhead text-label-2">Loading nudges…</p>
        ) : q.isError ? (
          <Card>
            <Empty title="Couldn't load nudges" body="Check your connection." action={<Button variant="tinted" onClick={() => void q.refetch()}>Retry</Button>} />
          </Card>
        ) : q.nudges.length === 0 ? (
          <Card>
            <Empty icon={<BellRing className="size-10" />} title="No nudges yet" body="When someone in your group cheers you on, it shows up here." />
          </Card>
        ) : (
          <List>
            {q.nudges.map((n) => (
              <Row
                key={n.id}
                leading={
                  <span className={cn('ml-4 grid size-8 shrink-0 place-items-center rounded-full', n.delivery === 'cheer' ? 'bg-orange/15 text-orange' : 'bg-blue/12 text-blue')}>
                    {n.delivery === 'cheer' ? <PartyPopper className="size-4" /> : <BellRing className="size-4" />}
                  </span>
                }
                title={
                  <span className={cn(!n.readAt && 'font-semibold')}>
                    {n.fromName}: {line(n)}
                  </span>
                }
                subtitle={`${n.groupName ? `${n.groupName} · ` : ''}${dayjs(n.createdAt).fromNow()}`}
              />
            ))}
          </List>
        )}
      </div>
    </Sheet>
  );
}
