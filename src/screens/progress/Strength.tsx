import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Equal, TrendingUp } from 'lucide-react';
import { getExercise } from '@/domain/catalogue';
import { bestSet, exerciseHistory, toDisplay } from '@/domain/stats';
import { overallStrength } from '@/domain/strength';
import { Chart } from '@/components/Chart';
import { Card, Empty, List, Row, SectionHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/cn';
import { exName, fmtDay, fmtLoad } from '@/lib/fmt';
import { useData } from '@/store/app';

const COLOR = '#007AFF';
const ALL = 'all';

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;

/** Every lift against its own start, averaged: the default view. */
function Overall({ onPick }: { onPick: (id: string) => void }) {
  const data = useData();
  const units = data.profile.units;
  const o = useMemo(() => overallStrength(data), [data]);
  const [metric, setMetric] = useState<'index' | 'volume'>('index');
  const repeated = o.lifts.filter((l) => l.sessions > 1).length;
  const up = (o.change ?? 0) > 0.005;
  const down = (o.change ?? 0) < -0.005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Equal;
  const points =
    metric === 'index'
      ? o.points.map((p) => ({ date: p.date, value: Math.round(p.index), detail: `${p.lifts} ${p.lifts === 1 ? 'lift' : 'lifts'} that week` }))
      : o.volume.map((v) => ({ date: v.date, value: toDisplay(v.kg, units), detail: 'Week total' }));

  return (
    <>
      <Card className="mt-3 p-4">
        <div className="text-footnote font-semibold text-label-2">Overall strength</div>
        {o.change == null ? (
          <p className="mt-1 text-subhead text-label-2">Repeat a lift once more and your overall trend starts here.</p>
        ) : (
          <>
            <div className={cn('mt-1 flex items-center gap-1 text-largetitle font-bold tabular', up ? 'text-[#248A3D]' : down ? 'text-[#C93400]' : 'text-label')}>
              <Icon className="size-8" strokeWidth={2.5} />
              {pct(o.change)}
            </div>
            <div className="text-footnote text-label-2">
              Average across {repeated} {repeated === 1 ? 'lift' : 'lifts'}, each against its first session
            </div>
          </>
        )}
      </Card>

      <Card className="mt-3 p-4">
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'index', label: 'Strength' },
            { value: 'volume', label: 'Weekly volume' },
          ]}
        />
        <div className="mt-3">
          {points.length > 1 ? (
            <Chart points={points} color={COLOR} unit={metric === 'index' ? '% of start' : units} kind={metric === 'index' ? 'line' : 'bar'} />
          ) : (
            <p className="py-10 text-center text-subhead text-label-2">One week logged. The trend appears after next week.</p>
          )}
        </div>
        <p className="mt-2 text-caption text-label-2">{metric === 'index' ? '100% is where each lift started. Estimated one-rep max for weights, reps for bodyweight.' : 'Load × reps of every set ticked done, per week.'}</p>
      </Card>

      <SectionHeader title="Lifts" />
      <List>
        {o.lifts.map((l) => (
          <Row
            key={l.exerciseId}
            title={exName(data, l.exerciseId)}
            subtitle={`${l.sessions} ${l.sessions === 1 ? 'session' : 'sessions'}`}
            value={
              l.sessions > 1 ? (
                <span className={cn('font-semibold tabular', l.change > 0.005 ? 'text-[#248A3D]' : l.change < -0.005 ? 'text-[#C93400]' : '')}>{pct(l.change)}</span>
              ) : (
                'New'
              )
            }
            onClick={() => onPick(l.exerciseId)}
            chevron
          />
        ))}
      </List>
    </>
  );
}

export function Strength() {
  const data = useData();
  const units = data.profile.units;

  const trained = useMemo(() => {
    const latest = new Map<string, string>();
    for (const s of data.sessions)
      if (s.finishedAt)
        for (const e of s.exercises) if (e.sets.some((x) => x.status === 'done') && (latest.get(e.exerciseId) ?? '') < s.startedAt) latest.set(e.exerciseId, s.startedAt);
    return [...latest.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id);
  }, [data.sessions]);

  const [picked, setPicked] = useState<string>(ALL);
  const [metric, setMetric] = useState<'top' | 'volume'>('top');

  if (!trained.length) return <Empty icon={<TrendingUp className="size-12" />} title="No lifts yet" body="Finish a workout and your strength trend shows up here." />;

  const picker = (
    <div className="mt-4 flex items-center justify-between rounded-[12px] bg-card px-4 py-2.5 shadow-card">
      <span className="text-subhead text-label-2">Exercise</span>
      <Select
        label="Exercise"
        value={picked !== ALL && trained.includes(picked) ? picked : ALL}
        options={[{ value: ALL, label: 'All lifts' }, ...trained.map((t) => ({ value: t, label: exName(data, t) }))]}
        onChange={setPicked}
      />
    </div>
  );

  if (picked === ALL || !trained.includes(picked))
    return (
      <>
        {picker}
        <Overall onPick={setPicked} />
      </>
    );
  const id = picked;

  const ex = getExercise(id, data.customExercises);
  const bodyweight = ex?.kind !== 'weighted';
  const timed = ex?.kind === 'timed';
  const history = exerciseHistory(data, id);
  const best = bestSet(data, id);
  const last = history.at(-1);
  const prev = history.at(-2);

  const points = history.map((h) =>
    metric === 'top'
      ? {
          date: h.date,
          value: bodyweight ? h.bestReps : toDisplay(h.bestKg, units),
          detail: h.sets.map((s) => (bodyweight ? `${s.actualReps}` : `${toDisplay(s.actualKg ?? 0, units)}×${s.actualReps}`)).join(' · '),
        }
      : { date: h.date, value: bodyweight ? h.totalReps : toDisplay(h.volume, units), detail: `${h.sets.length} sets` },
  );
  const unit = metric === 'top' ? (bodyweight ? (timed ? 's' : 'reps') : units) : bodyweight ? (timed ? 's total' : 'reps total') : units;

  return (
    <>
      {picker}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-footnote font-semibold text-label-2">Best set</div>
          <div className="mt-1 text-title2 font-bold tabular">
            {best ? (bodyweight ? `${best.reps}${timed ? 's' : ''}` : fmtLoad(best.kg, units)) : '—'}
          </div>
          <div className="text-footnote text-label-2">
            {best ? `${bodyweight ? (best.kg ? `+${fmtLoad(best.kg, units)}` : 'bodyweight') : `× ${best.reps}`} · ${fmtDay(best.date)}` : ''}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-footnote font-semibold text-label-2">Last vs previous</div>
          <Delta prev={prev} last={last} bodyweight={bodyweight} units={units} />
        </Card>
      </div>

      <Card className="mt-3 p-4">
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'top', label: bodyweight ? 'Best set' : 'Top set load' },
            { value: 'volume', label: bodyweight ? 'Total reps' : 'Volume' },
          ]}
        />
        <div className="mt-3">
          {points.length > 1 ? (
            <Chart points={points} color={COLOR} unit={unit} kind={metric === 'top' ? 'line' : 'bar'} />
          ) : (
            <p className="py-10 text-center text-subhead text-label-2">One session logged. The trend appears after your next one.</p>
          )}
        </div>
        <p className="mt-2 text-caption text-label-2">Only sets you ticked as done count. Swapped exercises keep separate histories.</p>
      </Card>

      <SectionHeader title="Sessions" />
      <List>
        {[...history]
          .reverse()
          .slice(0, 12)
          .map((h) => (
            <Row
              key={h.sessionId}
              title={h.sets.map((s) => (bodyweight ? `${s.actualReps}${timed ? 's' : ''}` : `${toDisplay(s.actualKg ?? 0, units)}×${s.actualReps}`)).join(' · ')}
              subtitle={fmtDay(h.date)}
            />
          ))}
      </List>
    </>
  );
}

interface DeltaProps {
  prev?: { bestKg: number; bestReps: number };
  last?: { bestKg: number; bestReps: number };
  bodyweight: boolean;
  units: 'kg' | 'lb';
}

function Delta({ prev, last, bodyweight, units }: DeltaProps) {
  if (!prev || !last) return <div className="mt-1 text-subhead text-label-2">Needs two sessions</div>;
  const dKg = last.bestKg - prev.bestKg;
  const dReps = last.bestReps - prev.bestReps;
  const up = dKg > 0 || (dKg === 0 && dReps > 0);
  const down = dKg < 0 || (dKg === 0 && dReps < 0);
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Equal;
  const text =
    !bodyweight && dKg !== 0
      ? `${dKg > 0 ? '+' : '−'}${fmtLoad(Math.abs(dKg), units)}`
      : dReps !== 0
        ? `${dReps > 0 ? '+' : '−'}${Math.abs(dReps)} reps`
        : 'Same';
  return (
    <>
      <div className={cn('mt-1 flex items-center gap-1 text-title2 font-bold tabular', up ? 'text-[#248A3D]' : down ? 'text-[#C93400]' : 'text-label')}>
        <Icon className="size-6" strokeWidth={2.5} />
        {text}
      </div>
      <div className="text-footnote text-label-2">best set, last two sessions</div>
    </>
  );
}
