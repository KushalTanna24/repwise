import { useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Cloud, CloudOff, Download, LoaderCircle, Upload } from 'lucide-react';
import { ALL_EQUIPMENT } from '@/domain/catalogue';
import { parseImport } from '@/domain/migrate';
import { updateProfile } from '@/domain/session';
import { SPLITS } from '@/domain/splits';
import { fromDisplay, parseNumber, toDisplay } from '@/domain/stats';
import type { AppData, EquipmentKind, Profile as ProfileT } from '@/domain/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Card, List, Row, SectionHeader } from '@/components/ui/card';
import { FieldRow, Select, Switch, TextInput } from '@/components/ui/field';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { fmtDay, nowIso } from '@/lib/fmt';
import { openSheet } from '@/lib/route';
import { toast } from '@/lib/toast';
import { act, useApp, useData } from '@/store/app';
import { signIn, signOut, useSyncState } from '@/sync/useSync';
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
            ]}
          />
        </FieldRow>
        <FieldRow label="Units">
          <Select label="Units" value={p.units} onChange={(units) => setProfile({ units }, false)} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </FieldRow>
      </List>
      <p className="px-4 pt-2 text-footnote text-label-2">Goal and session length change sets, reps and exercise count from your next workout. History is never touched.</p>

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
      <Account />

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

function Account() {
  const { user, status, message, lastSyncedAt, retry } = useSyncState();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast('Enter a valid email');
    setSending(true);
    const err = await signIn(email.trim());
    setSending(false);
    if (err) toast(`Couldn't send the link: ${err}`);
    else setSent(true);
  }

  async function out() {
    const ok = await confirm({ title: 'Sign out?', message: 'Your data stays on this phone. Backups pause until you sign in again.', confirmLabel: 'Sign out' });
    if (ok) await signOut();
  }

  if (!user)
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-headline font-semibold">
          <CloudOff className="size-5 text-label-2" /> Saved on this phone only
        </div>
        <p className="mt-1 text-subhead text-label-2">Sign in with a magic link to back up to the cloud and restore on a new phone.</p>
        {sent ? (
          <p className="mt-3 rounded-[12px] bg-green/12 px-3 py-2 text-subhead text-[#248A3D]">Check {email} and open the link on this phone.</p>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[10px] bg-fill px-3 text-body outline-none focus:ring-2 focus:ring-blue"
            />
            <Button onClick={send} disabled={sending}>
              {sending ? <LoaderCircle className="size-4 animate-spin" /> : 'Send link'}
            </Button>
          </div>
        )}
      </Card>
    );

  const label = status === 'synced' ? `Backed up${lastSyncedAt ? ` · ${dayjs(lastSyncedAt).format('HH:mm')}` : ''}` : status === 'syncing' ? 'Backing up…' : status === 'error' ? 'Not backed up' : 'Waiting';
  return (
    <List>
      <Row
        leading={<Cloud className={cn('size-5', status === 'error' ? 'text-red' : 'text-blue')} />}
        title={user.email ?? 'Signed in'}
        subtitle={message ?? label}
        value={status === 'syncing' ? <LoaderCircle className="size-4 animate-spin" /> : undefined}
      />
      {status === 'error' && <Row title="Retry backup" onClick={retry} className="text-blue" />}
      <Row title="Sign out" onClick={out} destructive />
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