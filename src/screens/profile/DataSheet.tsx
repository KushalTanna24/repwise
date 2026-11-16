import { useRef } from 'react';
import dayjs from 'dayjs';
import { Download, Upload } from 'lucide-react';
import { parseImport } from '@/domain/migrate';
import { Sheet } from '@/components/ui/sheet';
import { List, Row } from '@/components/ui/card';
import { confirm } from '@/components/ui/alert';
import { fmtDay, nowIso } from '@/lib/fmt';
import { toast } from '@/lib/toast';
import { useApp, useData } from '@/store/app';
import { signOut, useSyncState } from '@/sync/useSync';
import { Done } from './Done';

function download(name: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const user = useSyncState().user;
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

  async function out() {
    const ok = await confirm({ title: 'Sign out?', message: 'Your data stays on this phone. Backups pause until you sign in again.', confirmLabel: 'Sign out' });
    if (ok) await signOut();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your data" right={<Done onClose={onClose} />}>
      <List>
        <Row leading={<Download className="size-5 text-blue" />} title="Export backup" subtitle={`${data.sessions.length} workouts · ${data.bodyweights.length} weigh-ins`} onClick={() => exportAll()} />
        <Row leading={<Upload className="size-5 text-blue" />} title="Restore from file" subtitle="Repwise JSON, including old-app backups" onClick={() => file.current?.click()} />
      </List>
      {user && (
        <div className="mt-3">
          <List>
            <Row title="Sign out" onClick={out} destructive />
          </List>
        </div>
      )}
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
    </Sheet>
  );
}
