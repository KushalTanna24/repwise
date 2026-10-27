import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmHost } from '@/components/ui/alert';
import { TabBar } from '@/components/TabBar';
import { Toaster } from '@/components/Toaster';
import { IgniteOverlay } from '@/components/IgniteOverlay';
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
import { SupplementSheet } from '@/screens/SupplementLibrary';
import { TrainingSheet } from '@/screens/profile/TrainingSheet';
import { GoalsSheet } from '@/screens/profile/GoalsSheet';
import { BodySheet } from '@/screens/profile/BodySheet';
import { EquipmentSheet } from '@/screens/profile/EquipmentSheet';
import { RemindersSheet } from '@/screens/profile/RemindersSheet';
import { DataSheet } from '@/screens/profile/DataSheet';
import { GuideSheet } from '@/screens/Guide';
import { LeaveSheet } from '@/screens/LeaveSheet';
import { FastSheet } from '@/screens/FastSheet';
import { ChallengesSheet } from '@/screens/challenges/ChallengesSheet';
import { NewChallengeSheet } from '@/screens/challenges/NewChallengeSheet';
import { RunDetailSheet } from '@/screens/challenges/RunDetailSheet';
import { Splash } from '@/components/Splash';
import { DailyBanner } from '@/components/DailyBanner';
import { AuthBanner } from '@/components/AuthBanner';

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
      <SupplementSheet open={kind === 'supps'} onClose={closeSheet} />
      <TrainingSheet open={kind === 'profile' && arg === 'training'} onClose={closeSheet} />
      <GoalsSheet open={kind === 'profile' && arg === 'goals'} onClose={closeSheet} />
      <BodySheet open={kind === 'profile' && arg === 'body'} onClose={closeSheet} />
      <EquipmentSheet open={kind === 'profile' && arg === 'equipment'} onClose={closeSheet} />
      <RemindersSheet open={kind === 'profile' && arg === 'reminders'} onClose={closeSheet} />
      <DataSheet open={kind === 'profile' && arg === 'data'} onClose={closeSheet} />
      <LeaveSheet open={kind === 'leave'} onClose={closeSheet} />
      <FastSheet open={kind === 'fast'} onClose={closeSheet} />
      <ChallengesSheet open={kind === 'challenges'} onClose={closeSheet} />
      <NewChallengeSheet templateId={kind === 'challenge-new' ? (arg as '75-day' | 'habit-stack' | 'custom') : null} onClose={closeSheet} />
      <RunDetailSheet runId={kind === 'challenge' ? arg : null} onClose={closeSheet} />
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

  return (
    <>
      {hydrated && (
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
          <GuideSheet />
          <ConfirmHost />
          <Toaster />
          <IgniteOverlay />
          <DailyBanner />
          <AuthBanner />
        </>
      )}
      {/* One mount for the whole launch so the reveal never replays. */}
      <Splash />
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
