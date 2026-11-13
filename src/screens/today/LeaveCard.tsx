import dayjs from 'dayjs';
import { Plane } from 'lucide-react';
import { currentLeave, endLeave } from '@/domain/leave';
import type { AppData } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { act } from '@/store/app';

/** Calm first card while on leave. */
export function LeaveCard({ data, today }: { data: AppData; today: string }) {
  const leave = currentLeave(data, today);
  if (!leave) return null;
  return (
    <Card className="mt-4 flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-label-2">
        <Plane className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-headline font-semibold">{leave.end ? `On leave until ${dayjs(leave.end).format('D MMM')}` : 'On leave'}</div>
        <div className="text-subhead text-label-2">Streak paused.</div>
      </div>
      <Button
        variant="gray"
        size="sm"
        onClick={() => {
          act((d) => endLeave(d, today));
          toast('Welcome back. Today counts again');
        }}
      >
        End leave
      </Button>
    </Card>
  );
}
