import { Sheet } from '@/components/ui/sheet';
import { List, Row } from '@/components/ui/card';
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

export function RemindersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Reminders" right={<Done onClose={onClose} />}>
      <NotificationsRow />
    </Sheet>
  );
}
