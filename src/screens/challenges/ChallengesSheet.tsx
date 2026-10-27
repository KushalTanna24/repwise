import { Flame as FlameIcon, ListChecks, Mountain, Timer, Trophy } from 'lucide-react';
import { activeRuns, canStart, challengeScore, dayNumber } from '@/domain/challenges';
import { activeFast, elapsedHours } from '@/domain/fasting';
import type { AppData, ChallengeRun } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { List, Row, SectionHeader } from '@/components/ui/card';
import { nowIso } from '@/lib/fmt';
import { openSheet } from '@/lib/route';
import { useToday } from '@/lib/useToday';
import { useData } from '@/store/app';
import { Done } from '../profile/Done';

const CATALOGUE = [
  { id: '75-day', title: '75-Day Challenge', blurb: 'Two workouts, water, diet, reading and a photo, every day. Miss one and restart.', icon: Mountain },
  { id: 'habit-stack', title: 'Habit stack', blurb: 'Chain 1–3 new habits onto one you already do.', icon: ListChecks },
  { id: 'custom', title: 'Build your own', blurb: 'Your name, length and tasks.', icon: Trophy },
] as const;

export function runSubtitle(data: AppData, run: ChallengeRun, today: string): string {
  if (run.status === 'active') return run.startDate > today ? 'Starts tomorrow' : `Day ${dayNumber(run, today)} of ${run.days}`;
  if (run.status === 'failed') return `Missed day ${run.failedDay}`;
  const s = challengeScore(data, run, today);
  return run.status === 'quit' ? `Quit · ${s.complete} of ${s.elapsed} days` : `Finished · ${s.complete} of ${run.days} days`;
}

export function ChallengesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const room = canStart(data);
  const fast = activeFast(data);
  const past = data.challenges.filter((r) => r.status !== 'active').reverse();
  const icon = (I: typeof Trophy) => <I className="size-5 shrink-0 text-orange" />;

  return (
    <Sheet open={open} onClose={onClose} tall title="Challenges" right={<Done onClose={onClose} />}>
      <List>
        {CATALOGUE.map((c) => (
          <Row
            key={c.id}
            leading={icon(c.icon)}
            title={c.title}
            subtitle={c.blurb}
            onClick={room ? () => openSheet(`challenge-new:${c.id}`) : undefined}
            chevron={room}
            className={room ? undefined : 'opacity-50'}
          />
        ))}
        <Row
          leading={icon(Timer)}
          title={fast ? `Fasting · ${Math.floor(elapsedHours(fast, nowIso()))}h` : 'Start a fast'}
          subtitle="16, 24 or 36 hours, with milestones."
          onClick={() => openSheet('fast')}
          chevron
        />
      </List>
      {!room && <p className="px-4 pt-2 text-footnote text-label-2">Finish or quit one first.</p>}

      {activeRuns(data).length > 0 && (
        <>
          <SectionHeader title="Active" />
          <List>
            {activeRuns(data).map((r) => (
              <Row key={r.id} leading={<FlameIcon className="size-5 shrink-0 text-orange" />} title={r.title} subtitle={runSubtitle(data, r, today)} onClick={() => openSheet(`challenge:${r.id}`)} chevron />
            ))}
          </List>
        </>
      )}
      {past.length > 0 && (
        <>
          <SectionHeader title="Past" />
          <List>
            {past.map((r) => (
              <Row key={r.id} title={r.title} subtitle={runSubtitle(data, r, today)} onClick={() => openSheet(`challenge:${r.id}`)} chevron />
            ))}
          </List>
        </>
      )}
    </Sheet>
  );
}
