import dayjs from 'dayjs';
import { challengeScore, dayComplete, quitChallenge } from '@/domain/challenges';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { useToday } from '@/lib/useToday';
import { act, useData } from '@/store/app';
import { Done } from '../profile/Done';
import { runSubtitle } from './ChallengesSheet';
import { PhotoTimeline } from './PhotoTimeline';

/** One run: day grid, score, quit. */
export function RunDetailSheet({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const run = data.challenges.find((r) => r.id === runId);
  const score = run ? challengeScore(data, run, today) : null;

  async function quit() {
    if (!run) return;
    const ok = await confirm({ title: `Quit ${run.title}?`, message: 'Your progress so far stays in History.', confirmLabel: 'Quit', destructive: true });
    if (!ok) return;
    act((d) => quitChallenge(d, run.id, today));
    toast('Challenge ended');
  }

  return (
    <Sheet open={!!run} onClose={onClose} tall title={run?.title ?? ''} right={<Done onClose={onClose} />}>
      {run && score && (
        <>
          <p className="px-4 pb-1 text-title3 font-bold">{runSubtitle(data, run, today)}</p>
          <p className="px-4 pb-3 text-subhead text-label-2">
            {score.complete} of {score.elapsed} days complete{run.restarts ? ` · ${run.restarts} restart${run.restarts > 1 ? 's' : ''}` : ''}
            {run.anchor ? ` · after ${run.anchor}` : ''}
          </p>
          <Card className="p-4">
            <div className="grid grid-cols-10 gap-1.5" role="list" aria-label="Days">
              {Array.from({ length: run.days }, (_, i) => {
                const date = dayjs(run.startDate).add(i, 'day').format('YYYY-MM-DD');
                const past = date < today;
                const done = date <= today && dayComplete(data, run, date);
                return (
                  <span
                    key={date}
                    role="listitem"
                    aria-label={`Day ${i + 1}${done ? ', done' : past ? ', missed' : ''}`}
                    className={cn(
                      'aspect-square rounded-[5px]',
                      done ? 'bg-green' : past ? 'bg-red/25' : 'bg-fill',
                      date === today && 'ring-2 ring-orange',
                    )}
                  />
                );
              })}
            </div>
          </Card>
          <PhotoTimeline data={data} run={run} />
          {run.status === 'active' && (
            <Button variant="destructive" className="mt-6 w-full" onClick={() => void quit()}>
              Quit challenge
            </Button>
          )}
        </>
      )}
    </Sheet>
  );
}
