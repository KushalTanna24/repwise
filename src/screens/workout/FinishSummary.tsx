import { motion, useReducedMotion } from 'motion/react';
import { Check, Trophy } from 'lucide-react';
import { sessionVolume } from '@/domain/stats';
import type { AppData, WorkoutSession } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { exName, fmtDuration, fmtLoad } from '@/lib/fmt';

export interface Summary {
  session: WorkoutSession;
  prs: { exerciseId: string; kg: number; reps: number }[];
  next: string | null;
}

export function FinishSummary({ data, summary, onDone }: { data: AppData; summary: Summary; onDone: () => void }) {
  const reduce = useReducedMotion();
  const { session, prs, next } = summary;
  const v = sessionVolume(session);
  const units = data.profile.units;
  const stats = [
    { label: 'Time', value: fmtDuration(Date.parse(session.finishedAt!) - Date.parse(session.startedAt)) },
    { label: 'Sets', value: String(v.sets) },
    { label: 'Volume', value: fmtLoad(Math.round(v.volume), units) },
  ];

  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <motion.div
        initial={reduce ? false : { scale: 0.3, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        className="grid size-24 place-items-center rounded-full bg-green text-white shadow-[0_10px_30px_rgb(52_199_89/0.45)]"
      >
        <Check className="size-12" strokeWidth={3.5} />
      </motion.div>
      <h2 className="mt-5 text-largetitle font-bold">Workout saved</h2>
      <p className="text-subhead text-label-2">{session.title}</p>

      <Card className="mt-6 grid w-full grid-cols-3 divide-x divide-sep py-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-footnote font-semibold text-label-2">{s.label}</div>
            <div className="mt-0.5 text-title3 font-bold tabular">{s.value}</div>
          </div>
        ))}
      </Card>

      {prs.length > 0 && (
        <Card className="mt-4 w-full p-4 text-left">
          <div className="flex items-center gap-2 text-headline font-semibold text-purple">
            <Trophy className="size-5" /> New bests
          </div>
          <ul className="mt-2 grid gap-2">
            {prs.map((p, i) => (
              <motion.li
                key={p.exerciseId}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex justify-between text-body"
              >
                <span>{exName(data, p.exerciseId)}</span>
                <span className="font-semibold tabular">
                  {p.kg > 0 ? `${fmtLoad(p.kg, units)} × ` : ''}
                  {p.reps}
                </span>
              </motion.li>
            ))}
          </ul>
        </Card>
      )}

      {next && <p className="mt-6 text-subhead text-label-2">Next up: <span className="font-semibold text-label">{next}</span>. Targets are updated from today.</p>}
      <Button size="lg" className="mt-6" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
