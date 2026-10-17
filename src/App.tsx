import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmHost } from '@/components/ui/alert';
import { TabBar } from '@/components/TabBar';
import { Toaster } from '@/components/Toaster';
import { closeSheet, useRoute } from '@/lib/route';
import { boot } from '@/store/boot';
import { useApp } from '@/store/app';
import { useSyncEngine } from '@/sync/useSync';
import { Today } from '@/screens/Today';
import { History } from '@/screens/History';
import { Profile } from '@/screens/Profile';
import { WorkoutSheet } from '@/screens/Workout';
import { SessionSheet } from '@/screens/SessionDetail';
import { SplitSheet } from '@/screens/SplitPicker';
import { ExtraSheet } from '@/screens/LogExtra';
import { LibrarySheet } from '@/screens/Library';

const queryClient = new QueryClient();
// Charts are the heaviest dependency; load them only when Progress opens.
const Progress = lazy(() => import('@/screens/Progress').then((m) => ({ default: m.Progress })));

function Sheets() {
  const sheet = useRoute((r) => r.sheet) ?? '';
  const [kind, arg] = sheet.split(':');
  return (
    <>
      <WorkoutSheet open={kind === 'workout'} onClose={closeSheet} />
      <SessionSheet sessionId={kind === 'session' ? arg : null} onClose={closeSheet} />
      <SplitSheet open={kind === 'split'} onClose={closeSheet} />
      <ExtraSheet open={kind === 'extra'} onClose={closeSheet} />
      <LibrarySheet open={kind === 'library'} onClose={closeSheet} />
    </>
  );
}

function Shell() {
  useSyncEngine();
  const tab = useRoute((r) => r.tab);
  const hydrated = useApp((s) => s.hydrated);

  useEffect(() => {
    void boot();
  }, []);

  if (!hydrated) return <div className="min-h-dvh bg-bg" aria-busy="true" />;

  return (
    <>
      {tab === 'today' && <Today />}
      {tab === 'history' && <History />}
      {tab === 'progress' && (
        <Suspense fallback={<div className="min-h-dvh" />}>
          <Progress />
        </Suspense>
      )}
      {tab === 'profile' && <Profile />}
      <TabBar />
      <Sheets />
      <ConfirmHost />
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
