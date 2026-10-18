import { useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Download, Upload } from 'lucide-react';
import { ALL_EQUIPMENT } from '@/domain/catalogue';
import { parseImport } from '@/domain/migrate';
import { applyProfileToActive, updateProfile } from '@/domain/session';
import { addSupplement, renameSupplement, setSupplementArchived } from '@/domain/supplements';
import { addGoal, removeGoal } from '@/domain/calendar';
import { Menu } from '@/components/ui/menu';
import { SPLITS } from '@/domain/splits';
import { fromDisplay, parseNumber, toDisplay } from '@/domain/stats';
import type { AppData, EquipmentKind, Profile as ProfileT } from '@/domain/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Card, List, Row, SectionHeader } from '@/components/ui/card';
import { FieldRow, Select, Switch, TextInput } from '@/components/ui/field';
import { confirm } from '@/components/ui/alert';
import { fmtDay, nowIso } from '@/lib/fmt';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useApp, useData } from '@/store/app';
import { SignInCard } from './profile/SignInCard';
import { requestNotifications, useNotifyPermission } from '@/lib/notify';

const EQUIPMENT_LABEL: Record<EquipmentKind, string> = {
  barbell: 'Barbells & racks',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  cable: 'Cable stack',
  bodyweight: 'Pull-up bar & dip station',
};

function setProfile(patch: Partial<ProfileT>, note = true) {
  const busy = !!useApp.getState().data.activeSession;
  act((d) => updateProfile(d, patch));
  if (note) toast(busy ? 'Saved. Applies after this workout' : 'Saved. Applies from your next workout');
}

export function Profile() {
  const data = useData();
  const p = data.profile;
  return (
    <Screen title="Profile">
      <SectionHeader title="Training" />
      <List>
        <Row title="Split" value={data.program.splitId ? SPLITS[data.program.splitId].name : 'Not set'} onClick={() => openSheet('split')} chevron />
        <FieldRow label="Goal">
          <Select
            label="Goal"
            value={p.objective}
            onChange={(objective) => setProfile({ objective })}
            options={[
              { value: 'hypertrophy', label: 'Build muscle' },
              { value: 'strength', label: 'Get stronger' },
              { value: 'general', label: 'General fitness' },
            ]}
          />
        </FieldRow>
        <FieldRow label="Experience">
          <Select
            label="Experience"
            value={p.experience}
            onChange={(experience) => setProfile({ experience }, false)}
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
        </FieldRow>
        <FieldRow label="Days per week">
          <Select label="Days per week" value={p.daysPerWeek} onChange={(daysPerWeek) => setProfile({ daysPerWeek }, false)} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
        </FieldRow>
        <FieldRow label="Session length">
          <Select
            label="Session length"
            value={p.sessionMinutes}
            onChange={(sessionMinutes) => setProfile({ sessionMinutes })}
            options={[
              { value: 45 as const, label: '45 min' },
              { value: 60 as const, label: '60 min' },
              { value: 75 as const, label: '75 min' },
              { value: 90 as const, label: '90 min' },
            ]}
          />
        </FieldRow>
        <FieldRow label="Units">
          <Select label="Units" value={p.units} onChange={(units) => setProfile({ units }, false)} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </FieldRow>
      </List>
      <p className="px-4 pt-2 text-footnote text-label-2">Goal changes sets and reps, experience changes exercise choice and set count, session length adds or trims exercises. Applies from your next workout; history is never touched.</p>
      {data.activeSession && (
        <div className="mt-3">
          <List>
            <Row
              title="Apply to current workout"
              subtitle="Updates exercises you haven't started. Logged sets stay as they are."
              onClick={() => {
                act(applyProfileToActive);
                toast('Current workout updated');
              }}
              className="text-blue"
              chevron
            />
          </List>
        </div>
      )}

      <SectionHeader title="Goals" />
      <Goals data={data} />

      <SectionHeader title="Supplements" />
      <SupplementStack data={data} />

      <SectionHeader title="Body & goals" />
      <BodyGoals data={data} />

      <SectionHeader title="Equipment" />
      <List>
        {ALL_EQUIPMENT.map((k) => (
          <FieldRow key={k} label={EQUIPMENT_LABEL[k]}>
            <Switch
              label={EQUIPMENT_LABEL[k]}
              checked={p.equipment.includes(k)}
              onChange={(on) => setProfile({ equipment: on ? [...p.equipment, k] : p.equipment.filter((x) => x !== k) })}
            />
          </FieldRow>
        ))}
      </List>
      <div className="mt-3">
        <List>
          <Row
            title="Exercise library"
            subtitle={`${p.excludedExerciseIds.length} excluded · ${data.customExercises.length} custom`}
            onClick={() => openSheet('library')}
            chevron
          />
        </List>
      </div>

      <SectionHeader title="Notifications" />
      <NotificationsRow />

      <SectionHeader title="Backup & sync" />
      <SignInCard />

      <SectionHeader title="Your data" />
      <DataTools data={data} />

      <SectionHeader title="How recommendations work" />
      <Card className="grid gap-2 p-4 text-subhead text-label-2">
        <p>
          Repwise is <b className="text-label">rules-based</b>, not AI. Each split is a fixed rotation. Main lifts stay the same every cycle so you can compare them; accessories rotate between cycles.
        </p>
        <p>
          Targets come only from sets you ticked as done. Hit the top of the rep range on every set and the load goes up one small step. Miss the bottom of the range twice in a row and it comes down one step. Anything else holds the load and asks for one more rep.
        </p>
        <p>It can't see your form, sleep or pain. If something hurts, change the exercise or skip it.</p>
      </Card>
      <p className="py-6 text-center text-caption text-label-3">Repwise 4.0 · data stays on this phone unless you sign in</p>
    </Screen>
  );
}

function BodyGoals({ data }: { data: AppData }) {
  const p = data.profile;
  const [height, setHeight] = useState(p.heightCm ? String(p.heightCm) : '');
  const [target, setTarget] = useState(p.targetWeightKg ? String(toDisplay(p.targetWeightKg, p.units)) : '');
  const [goal, setGoal] = useState(p.goalNote ?? '');

  function commitHeight() {
    const cm = parseNumber(height);
    if (height && (cm == null || cm < 100 || cm > 250)) return toast('Height must be 100–250 cm');
    if ((cm ?? undefined) !== p.heightCm) act((d) => ({ ...d, profile: { ...d.profile, heightCm: cm ?? undefined } }));
  }
  function commitTarget() {
    const v = parseNumber(target);
    const kg = v == null ? undefined : +fromDisplay(v, p.units).toFixed(2);
    if (kg !== p.targetWeightKg) act((d) => ({ ...d, profile: { ...d.profile, targetWeightKg: kg } }));
  }

  return (
    <List>
      <FieldRow label="Height (cm)" hint="Used for BMI">
        <TextInput inputMode="decimal" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} onBlur={commitHeight} className="w-20" />
      </FieldRow>
      <FieldRow label={`Target weight (${p.units})`}>
        <TextInput inputMode="decimal" placeholder="Optional" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={commitTarget} className="w-24" />
      </FieldRow>
      <FieldRow label="Water goal" hint="Glasses of 250 ml a day">
        <Select
          label="Water goal"
          value={p.waterGoal}
          onChange={(waterGoal) => act((d) => ({ ...d, profile: { ...d.profile, waterGoal } }))}
          options={[4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map((n) => ({ value: n, label: `${n} glasses` }))}
        />
      </FieldRow>
      <label className="block px-4 py-3">
        <div className="text-body">Goal note</div>
        <div className="text-footnote text-label-2">Shown each time you open the app</div>
        <textarea
          rows={3}
          placeholder="e.g. 100 kg bench by March. Show up 3× a week."
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => goal.trim() !== (p.goalNote ?? '') && act((d) => ({ ...d, profile: { ...d.profile, goalNote: goal.trim() || undefined } }))}
          className="mt-2 w-full resize-none rounded-[10px] bg-fill px-3 py-2 text-body outline-none placeholder:text-label-3 focus:ring-2 focus:ring-blue"
        />
      </label>
    </List>
  );
}

function download(name: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DataTools({ data }: { data: AppData }) {
  const file = useRef<HTMLInputElement>(null);

  function exportAll(prefix = 'repwise-backup') {
    download(`${prefix}-${dayjs().format('YYYY-MM-DD-HHmm')}.json`, JSON.stringify(useApp.getState().data, null, 2));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = parseImport(await f.text(), nowIso());
    if (!r.ok) return toast(r.error);
    const { sessions, bodyweights, from, to } = r.summary;
    const ok = await confirm({
      title: 'Replace your data?',
      message: `This backup has ${sessions} workouts and ${bodyweights} weigh-ins${from ? ` (${fmtDay(from)} – ${fmtDay(to!)})` : ''}. Your current data (${data.sessions.length} workouts, ${data.bodyweights.length} weigh-ins) is downloaded first, then replaced.`,
      confirmLabel: 'Replace',
      destructive: true,
    });
    if (!ok) return;
    exportAll('repwise-before-import');
    useApp.getState().replace({ ...r.data, activeSession: null, meta: { ...r.data.meta, updatedAt: nowIso() } });
    toast('Backup restored');
  }

  return (
    <>
      <List>
        <Row leading={<Download className="size-5 text-blue" />} title="Export backup" subtitle={`${data.sessions.length} workouts · ${data.bodyweights.length} weigh-ins`} onClick={() => exportAll()} />
        <Row leading={<Upload className="size-5 text-blue" />} title="Restore from file" subtitle="Repwise JSON, including old-app backups" onClick={() => file.current?.click()} />
      </List>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
    </>
  );
}

function NotificationsRow() {
  const permission = useNotifyPermission((s) => s.permission);
  const state =
    permission === 'granted'
      ? { value: 'On', subtitle: 'Rest alerts 10 s before the end, even in other apps' }
      : permission === 'denied'
        ? { value: 'Blocked', subtitle: 'Chrome → site settings → Notifications → Allow, then reopen' }
        : permission === 'unsupported'
          ? { value: 'Not available', subtitle: 'Install Repwise to your home screen to use alerts' }
          : { value: 'Off', subtitle: 'Tap to allow rest timer alerts' };
  return (
    <List>
      <Row
        title="Rest timer alerts"
        subtitle={state.subtitle}
        value={state.value}
        onClick={permission === 'default' ? () => void requestNotifications().then((p) => toast(p === 'granted' ? 'Alerts on' : 'Alerts stay off')) : undefined}
        chevron={permission === 'default'}
      />
    </List>
  );
}
function Goals({ data }: { data: AppData }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayjs().add(3, 'month').format('YYYY-MM-DD'));
  function add() {
    if (!title.trim()) return toast('Name the goal');
    act((d) => addGoal(d, title, date));
    setTitle('');
    toast('Goal added to your calendar');
  }
  return (
    <>
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
    </>
  );
}

function SupplementStack({ data }: { data: AppData }) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  function add() {
    if (!name.trim()) return toast('Name the supplement');
    act((d) => addSupplement(d, name, dose));
    setName('');
    setDose('');
  }
  return (
    <>
      {data.supplements.length > 0 && (
        <List className="mb-3">
          {data.supplements.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-2.5 pl-4 pr-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
              <div className="min-w-0 flex-1">
                <div className={s.archived ? 'truncate text-body text-label-3' : 'truncate text-body'}>{s.name}</div>
                <div className="text-footnote text-label-2">{s.archived ? 'Archived · history kept' : (s.dose ?? 'Daily')}</div>
              </div>
              <Menu
                label={`${s.name} options`}
                trigger={<Button variant="plain" size="sm">Edit</Button>}
                items={[
                  {
                    label: 'Rename',
                    onSelect: () => {
                      const n = window.prompt('Rename supplement', s.name);
                      if (n?.trim()) act((d) => renameSupplement(d, s.id, n));
                    },
                  },
                  s.archived
                    ? { label: 'Restore', onSelect: () => act((d) => setSupplementArchived(d, s.id, false)) }
                    : { label: 'Archive', onSelect: () => act((d) => setSupplementArchived(d, s.id, true)), destructive: true },
                ]}
              />
            </div>
          ))}
        </List>
      )}
      <List>
        <FieldRow label="Name">
          <TextInput placeholder="e.g. Creatine" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
        </FieldRow>
        <FieldRow label="Dose">
          <TextInput placeholder="Optional, e.g. 5 g" value={dose} onChange={(e) => setDose(e.target.value)} className="w-40" />
        </FieldRow>
      </List>
      <Button className="mt-3 w-full" onClick={add}>
        Add supplement
      </Button>
    </>
  );
}