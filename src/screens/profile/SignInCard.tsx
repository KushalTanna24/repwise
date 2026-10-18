import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Cloud, CloudOff, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, List, Row } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { LAST_EMAIL_KEY } from '@/sync/authUrl';
import { signIn, signOut, useSyncState } from '@/sync/useSync';

const RESEND_SECONDS = 60;

function readEmail() {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}
function writeEmail(v: string) {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, v);
  } catch {
    /* prefill is a convenience only */
  }
}

export function SignInCard() {
  const { user, status, message, lastSyncedAt, retry } = useSyncState();
  const [email, setEmail] = useState(readEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send() {
    const to = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) return toast('Enter a valid email');
    setSending(true);
    const err = await signIn(to);
    setSending(false);
    if (err) return toast(err.network ? "Couldn't send the link. Check your connection" : `Couldn't send the link: ${err.message}`);
    writeEmail(to);
    setSent(true);
    setWait(RESEND_SECONDS);
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
          <div className="mt-3 grid gap-2">
            <p className="rounded-[12px] bg-green/12 px-3 py-2 text-subhead text-[#248A3D]">Open the link in the email, then come back to Repwise.</p>
            <div className="flex gap-2">
              <Button variant="plain" onClick={send} disabled={sending || wait > 0}>
                {wait > 0 ? `Resend (${wait}s)` : 'Resend'}
              </Button>
              <Button variant="plain" onClick={() => setSent(false)}>
                Change email
              </Button>
            </div>
          </div>
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
