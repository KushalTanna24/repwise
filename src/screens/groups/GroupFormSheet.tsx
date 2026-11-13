import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, List } from '@/components/ui/card';
import { FieldRow, Switch, TextInput } from '@/components/ui/field';
import { SignInCard } from '@/screens/profile/SignInCard';
import { groupErrorMessage, useCreateGroup, useJoinGroup, useMyDisplayName } from '@/lib/groups';
import { pendingJoin } from '@/lib/pendingJoin';
import { enablePush, pushSupported } from '@/lib/push';
import { reminderToggle } from '@/lib/pushUtil';
import { toast } from '@/lib/toast';
import { useSyncState } from '@/sync/useSync';

type Mode = { kind: 'create' } | { kind: 'join'; code: string };

/** Create a group, or join one by code. Then offers nudges on this phone. */
export function GroupFormSheet({ mode, onClose }: { mode: Mode | null; onClose: () => void }) {
  const user = useSyncState((s) => s.user);
  const lastName = useMyDisplayName();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [me, setMe] = useState('');
  const [share, setShare] = useState(false);
  const [step, setStep] = useState<'form' | 'push'>('form');
  const create = useCreateGroup();
  const join = useJoinGroup();
  const busy = create.isPending || join.isPending;
  const joining = mode?.kind === 'join';

  useEffect(() => {
    if (!mode) return;
    setStep('form');
    setName('');
    setShare(false);
    setMe(lastName);
    setCode(mode.kind === 'join' ? mode.code : '');
    // A signed-out visitor keeps the code across the sign-in link.
    if (mode.kind === 'join' && mode.code && !user) pendingJoin.save(mode.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode?.kind, mode?.kind === 'join' ? mode.code : null]);

  const valid = me.trim().length >= 1 && me.trim().length <= 24 && (joining ? code.trim().length >= 6 : name.trim().length >= 1 && name.trim().length <= 40);

  async function submit() {
    try {
      if (joining) await join.mutateAsync({ code, displayName: me, shareBody: share });
      else await create.mutateAsync({ name, displayName: me, shareBody: share });
      toast(joining ? "You're in" : 'Group created');
      if (pushSupported()) setStep('push');
      else onClose();
    } catch (e) {
      toast(groupErrorMessage(e));
    }
  }

  async function turnOnNudges() {
    const { message } = reminderToggle(await enablePush(user?.id ?? null, 'nudges'));
    toast(message ?? 'Nudges on for this phone');
    onClose();
  }

  const title = step === 'push' ? 'Nudges' : joining ? 'Join a group' : 'New group';

  return (
    <Sheet open={!!mode} onClose={onClose} title={title} left={<Button variant="plain" size="sm" className="-ml-2" onClick={onClose}>{step === 'push' ? 'Close' : 'Cancel'}</Button>}>
      <div className="pb-4">
        {!user ? (
          <>
            <p className="mt-2 px-1 text-subhead text-label-2">
              {joining ? 'Sign in first. Your invite is saved, so you land back here after the link.' : 'Sign in to create a group.'}
            </p>
            <SignInCard />
          </>
        ) : step === 'push' ? (
          <Card className="mt-2 p-5 text-center">
            <BellRing className="mx-auto size-10 text-blue" />
            <h3 className="mt-3 text-title3 font-bold">Get nudges on this phone?</h3>
            <p className="mt-1 text-subhead text-label-2">
              When someone in your group cheers you on, your phone lets you know. Never more than twice a day, and never at night.
            </p>
            <Button size="lg" className="mt-4" onClick={() => void turnOnNudges()}>Turn on</Button>
            <Button variant="plain" className="mt-1 w-full" onClick={onClose}>Not now</Button>
          </Card>
        ) : (
          <>
            <List>
              {joining ? (
                <FieldRow label="Invite code">
                  <TextInput
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="AB3CD7"
                    autoCapitalize="characters"
                    className="w-28 text-right tracking-widest"
                    aria-label="Invite code"
                  />
                </FieldRow>
              ) : (
                <FieldRow label="Group name">
                  <TextInput value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Family" className="w-40 text-right" aria-label="Group name" />
                </FieldRow>
              )}
              <FieldRow label="Your name in this group">
                <TextInput value={me} maxLength={24} onChange={(e) => setMe(e.target.value)} placeholder="Dad" className="w-32 text-right" aria-label="Your name in this group" />
              </FieldRow>
            </List>
            <List className="mt-4">
              <FieldRow label="Share body data with this group" hint="Weight, BMI, photos, fasting and supplements">
                <Switch checked={share} onChange={setShare} label="Share body data with this group" />
              </FieldRow>
            </List>
            <p className="mt-2 px-1 text-footnote text-label-2">Everyone in the group sees your workouts, split, streak and strength. You can change this any time.</p>
            <Button size="lg" className="mt-4" disabled={!valid || busy} onClick={() => void submit()}>
              {busy ? 'One moment…' : joining ? 'Join group' : 'Create group'}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
