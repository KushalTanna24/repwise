import { useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { List, Row } from '@/components/ui/card';
import { FieldRow, Select, Switch } from '@/components/ui/field';
import { DEFAULT_WATER_REMINDERS } from '@/domain/water';
import { disableReminders, enableReminders } from '@/lib/push';
import { reminderToggle } from '@/lib/pushUtil';
import { act, useData } from '@/store/app';
import { useSyncState } from '@/sync/useSync';
import { requestNotifications, useNotifyPermission } from '@/lib/notify';
import { toast } from '@/lib/toast';
import { Done } from './Done';

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

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

function WaterReminders() {
  const wr = useData().profile.waterReminders ?? DEFAULT_WATER_REMINDERS;
  const user = useSyncState((s) => s.user);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof wr>) =>
    act((d) => ({ ...d, profile: { ...d.profile, waterReminders: { ...(d.profile.waterReminders ?? DEFAULT_WATER_REMINDERS), ...patch } } }));

  async function toggle(next: boolean) {
    if (busy) return;
    if (!next) {
      set({ on: false });
      void disableReminders();
      return;
    }
    setBusy(true);
    const { on, message } = reminderToggle(await enableReminders(user?.id ?? null));
    setBusy(false);
    if (on) set({ on: true });
    if (message) toast(message);
  }

  return (
    <List>
      <FieldRow label="Water reminders" hint={user ? 'A nudge when you are behind on water' : 'Sign in to get water reminders'}>
        <div className={!user && !wr.on ? 'pointer-events-none opacity-40' : undefined} aria-disabled={!user && !wr.on}>
          <Switch label="Water reminders" checked={wr.on} onChange={(v) => void toggle(v)} />
        </div>
      </FieldRow>
      {wr.on && (
        <>
          <FieldRow label="From">
            <Select
              label="From"
              value={wr.from}
              onChange={(from) => set({ from, to: Math.max(wr.to, from + 1) })}
              options={HOURS.filter((h) => h < 23).map((h) => ({ value: h, label: hourLabel(h) }))}
            />
          </FieldRow>
          <FieldRow label="To">
            <Select label="To" value={wr.to} onChange={(to) => set({ to })} options={HOURS.filter((h) => h > wr.from).map((h) => ({ value: h, label: hourLabel(h) }))} />
          </FieldRow>
          <FieldRow label="Every">
            <Select
              label="Every"
              value={wr.everyHours}
              onChange={(everyHours) => set({ everyHours })}
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n} h` }))}
            />
          </FieldRow>
        </>
      )}
    </List>
  );
}

export function RemindersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Reminders" right={<Done onClose={onClose} />}>
      <NotificationsRow />
      <WaterReminders />
    </Sheet>
  );
}
