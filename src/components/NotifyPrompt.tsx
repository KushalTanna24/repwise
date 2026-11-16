import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { requestNotifications, useNotifyPermission } from '@/lib/notify';
import { toast } from '@/lib/toast';
import { Button } from './ui/button';
import { Card } from './ui/card';

const KEY = 'repwise_notify_asked';

/** Asks only after the user taps Allow, which is what Chrome requires. */
export function NotifyPrompt() {
  const permission = useNotifyPermission((s) => s.permission);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (permission !== 'default' || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* shows again next time; harmless */
    }
  };

  async function allow() {
    const p = await requestNotifications();
    close();
    toast(p === 'granted' ? "You'll get a buzz before rest ends" : 'Notifications stay off. Change it in Profile');
  }

  return (
    <Card className="mt-3 p-4">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-red text-white">
          <BellRing className="size-5" />
        </span>
        <div>
          <div className="text-headline font-semibold">Rest timer alerts</div>
          <p className="text-subhead text-label-2">Get a notification 10 seconds before rest ends, even when you switch to music or messages.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="gray" onClick={close}>
          Not now
        </Button>
        <Button onClick={allow}>Allow</Button>
      </div>
    </Card>
  );
}