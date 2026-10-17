import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CalendarDays, Dumbbell, Footprints, Sparkles, StretchHorizontal } from 'lucide-react';
import { sessionVolume, toDisplay } from '@/domain/stats';
import type { AppData, ExtraSession, WorkoutSession } from '@/domain/types';
import { Screen } from '@/components/Screen';
import { Empty, List, Row, SectionHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { confirm } from '@/components/ui/alert';
import { exName, fmtDuration } from '@/lib/fmt';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useData } from '@/store/app';

type Item = { kind: 'session'; at: string; s: WorkoutSession } | { kind: 'extra'; at: string; x: ExtraSession };

const EXTRA_ICON = { run: Footprints, mobility: StretchHorizontal, skills: Sparkles };

function weekLabel(start: dayjs.Dayjs) {
  const thisWeek = dayjs().startOf('day').subtract((dayjs().day() + 6) % 7, 'day');
  const diff = thisWeek.diff(start, 'week');
  if (diff === 0) return 'This week';
  if (diff === 1) return 'Last week';
  const end = start.add(6, 'day');
  return start.month() === end.month() ? `${start.format('D')}–${end.format('D MMM')}` : `${start.format('D MMM')} – ${end.format('D MMM')}`;
}

function Icon({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: color }}>
      {children}
    </span>
  );
}

export function History() {
  const data = useData();
  const [filter, setFilter] = useState('all');

  const exerciseOptions = useMemo(() => {
    const ids = [...new Set(data.sessions.flatMap((s) => s.exercises.filter((e) => e.sets.some((x) => x.status === 'done')).map((e) => e.exerciseId)))];
    return [{ value: 'all', label: 'All workouts' }, ...ids.map((id) => ({ value: id, label: exName(data, id) })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [data]);

  const groups = useMemo(() => grouped(data, filter), [data, filter]);

  async function removeExtra(x: ExtraSession) {
    const ok = await confirm({ title: 'Delete this entry?', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    act((d) => ({ ...d, extras: d.extras.filter((e) => e.id !== x.id) }));
    toast('Deleted');
  }

  return (
    <Screen title="History">
      {data.sessions.length + data.extras.length === 0 ? (
        <Empty icon={<CalendarDays className="size-12" />} title="No workouts yet" body="Finished workouts and extras land here, newest first." />
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between rounded-[12px] bg-card px-4 py-2.5 shadow-card">
            <span className="text-subhead text-label-2">Show</span>
            <Select label="Filter by exercise" value={filter} options={exerciseOptions} onChange={setFilter} />
          </div>
          {groups.length === 0 && <Empty title="Nothing here" body="No finished workouts include that exercise yet." />}
          {groups.map(([label, items]) => (
            <section key={label}>
              <SectionHeader title={label} />
              <List>
                {items.map((it) =>
                  it.kind === 'session' ? (
                    <SessionRow key={it.s.id} data={data} s={it.s} filter={filter} />
                  ) : (
                    <ExtraRow key={it.x.id} x={it.x} onClick={() => removeExtra(it.x)} />
                  ),
                )}
              </List>
            </section>
          ))}
        </>
      )}
    </Screen>
  );
}

function grouped(data: AppData, filter: string): [string, Item[]][] {
  const items: Item[] = [
    ...data.sessions
      .filter((s) => s.finishedAt && (filter === 'all' || s.exercises.some((e) => e.exerciseId === filter && e.sets.some((x) => x.status === 'done'))))
      .map((s) => ({ kind: 'session' as const, at: s.startedAt, s })),
    ...(filter === 'all' ? data.extras.map((x) => ({ kind: 'extra' as const, at: `${x.date}T12:00:00`, x })) : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const out = new Map<string, Item[]>();
  for (const it of items) {
    const d = dayjs(it.at);
    const key = weekLabel(d.startOf('day').subtract((d.day() + 6) % 7, 'day'));
    out.set(key, [...(out.get(key) ?? []), it]);
  }
  return [...out.entries()];
}

function SessionRow({ data, s, filter }: { data: AppData; s: WorkoutSession; filter: string }) {
  const v = sessionVolume(s);
  const partial = s.exercises.some((e) => e.sets.some((x) => x.status === 'skipped'));
  const focus = filter !== 'all' ? s.exercises.find((e) => e.exerciseId === filter) : undefined;
  const detail = focus
    ? focus.sets
        .filter((x) => x.status === 'done')
        .map((x) => (x.actualKg ? `${toDisplay(x.actualKg, data.profile.units)}×${x.actualReps}` : `${x.actualReps}`))
        .join(' · ')
    : `${v.sets} sets${s.finishedAt ? ` · ${fmtDuration(Date.parse(s.finishedAt) - Date.parse(s.startedAt))}` : ''}${partial ? ' · partial' : ''}`;
  return (
    <Row
      leading={
        <Icon color="#007AFF">
          <Dumbbell className="size-[18px]" />
        </Icon>
      }
      title={s.title}
      subtitle={`${dayjs(s.startedAt).format('ddd D MMM')} · ${detail}`}
      onClick={() => openSheet(`session:${s.id}`)}
      chevron
    />
  );
}

function ExtraRow({ x, onClick }: { x: ExtraSession; onClick: () => void }) {
  const I = EXTRA_ICON[x.type];
  const name = x.type === 'run' ? 'Run' : x.type === 'mobility' ? 'Mobility' : 'Skills';
  const bits = [x.distanceKm != null && `${x.distanceKm} km`, x.minutes != null && `${x.minutes} min`, x.note].filter(Boolean).join(' · ');
  return (
    <Row
      leading={
        <Icon color={x.type === 'run' ? '#34C759' : x.type === 'mobility' ? '#30B0C7' : '#AF52DE'}>
          <I className="size-[18px]" />
        </Icon>
      }
      title={name}
      subtitle={`${dayjs(x.date).format('ddd D MMM')}${bits ? ` · ${bits}` : ''}`}
      onClick={onClick}
    />
  );
}
