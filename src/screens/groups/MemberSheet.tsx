// One member's training, read-only. Reuses the History and Progress pieces inside a read-only DocProvider,
// so no control that edits or deletes is ever rendered here.
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Dumbbell, Lock } from 'lucide-react';
import '@/lib/fmt';
import { kindsSeen, type GoalKind } from '@/domain/goals';
import { getSplit } from '@/domain/training/splits/registry';
import { currentRotation } from '@/domain/training/rotation';
import type { AppData } from '@/domain/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, Empty, SectionHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { useGroupMembers, useMemberDoc, useMemberPhotos, useMyGroups } from '@/lib/groups';
import { useToday } from '@/lib/useToday';
import { DocProvider } from '@/store/docContext';
import { useSyncState } from '@/sync/useSync';
import { StreakHeader } from '@/screens/history/StreakHeader';
import { MuscleMap } from '@/screens/history/MuscleMap';
import { Calendar } from '@/screens/history/Calendar';
import { FilterChips } from '@/screens/history/FilterChips';
import { DayCard } from '@/screens/history/DayCard';
import { Strength } from '@/screens/progress/Strength';
import { Body } from '@/screens/progress/Body';
import { SessionDetailBody } from '@/screens/SessionDetail';
import { MemberPhotos } from './MemberPhotos';
import { NudgeButton } from './NudgeButton';

type Section = 'history' | 'strength' | 'body';

export function MemberSheet({ groupId, userId, onClose }: { groupId: string | null; userId: string | null; onClose: () => void }) {
  const open = !!groupId && !!userId;
  const viewer = useSyncState((s) => s.user?.id ?? null);
  const group = (useMyGroups().data ?? []).find((g) => g.id === groupId);
  const member = (useGroupMembers(groupId).data ?? []).find((m) => m.userId === userId);
  const q = useMemberDoc(groupId, userId);
  const [section, setSection] = useState<Section>('history');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const name = member?.displayName ?? 'Member';
  const doc = q.data?.doc ?? null;
  const shareBody = !!q.data?.shareBody;
  const photos = useMemberPhotos(groupId ?? '', userId ?? '', open && section === 'body' && shareBody && !!doc?.photos.length);

  useEffect(() => {
    setSection('history');
    setSessionId(null);
  }, [groupId, userId]);

  const session = sessionId && doc ? doc.sessions.find((s) => s.id === sessionId) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={session ? session.title : name}
      left={
        session ? (
          <Button variant="plain" size="sm" className="-ml-2" onClick={() => setSessionId(null)}>Back</Button>
        ) : (
          <Button variant="plain" size="sm" className="-ml-2" onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="pb-6">
        {q.isPending ? (
          <p className="py-10 text-center text-subhead text-label-2">Loading {name}'s training…</p>
        ) : q.isError ? (
          <Card className="mt-2">
            <Empty title={`Couldn't load ${name}'s data`} body="Check your connection." action={<Button variant="tinted" onClick={() => void q.refetch()}>Retry</Button>} />
          </Card>
        ) : !doc ? (
          <Card className="mt-2">
            <Empty icon={<Dumbbell className="size-10" />} title={`${name} hasn't synced yet`} body="Their training shows up after they sign in on their phone and log a workout." />
          </Card>
        ) : session ? (
          <SessionDetailBody data={doc} s={session} />
        ) : (
          <DocProvider data={doc} readOnly onOpenSession={setSessionId} photoUrls={photos.data}>
            <Header doc={doc} updatedAt={q.data?.updatedAt ?? null} />
            <Segmented
              className="mt-4"
              value={section}
              onChange={setSection}
              options={[
                { value: 'history', label: 'History' },
                { value: 'strength', label: 'Strength' },
                { value: 'body', label: 'Body' },
              ]}
            />
            {section === 'history' && <MemberHistory doc={doc} />}
            {section === 'strength' && <Strength />}
            {section === 'body' &&
              (shareBody ? (
                <>
                  <Body />
                  <SectionHeader title="Photos" />
                  <MemberPhotos photos={doc.photos} urls={photos.data} loading={photos.isPending && photos.fetchStatus !== 'idle'} failed={photos.isError} />
                </>
              ) : (
                <Card className="mt-4">
                  <Empty icon={<Lock className="size-10" />} title="Not shared with this group" body={`${name} keeps weight, BMI and photos private here.`} />
                </Card>
              ))}
          </DocProvider>
        )}
        {open && !session && groupId && userId && userId !== viewer && group && (
          <NudgeButton groupId={groupId} userId={userId} name={name} size="lg" className="mt-6" />
        )}
      </div>
    </Sheet>
  );
}

function Header({ doc, updatedAt }: { doc: AppData; updatedAt: string | null }) {
  const split = doc.program.splitId ? getSplit(doc, doc.program.splitId) : undefined;
  const rot = split ? currentRotation(doc, split.id) : null;
  const next = split && rot ? split.sessions[rot.sessionIndex % split.sessions.length] : null;
  const live = !!doc.activeSession;
  return (
    <Card className="mt-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-footnote font-semibold text-label-2">Split</div>
          <div className="truncate text-headline font-semibold">{split?.name ?? 'No split picked yet'}</div>
          {split && <div className="mt-0.5 text-footnote text-label-2">{split.sessions.map((s) => s.short ?? s.title).join(' · ')}</div>}
          {next && <div className="mt-1 text-footnote text-label-2">Next up: {next.title}</div>}
        </div>
        {live && <span className="shrink-0 rounded-full bg-green/15 px-2.5 py-1 text-footnote font-semibold text-green">Training now</span>}
      </div>
      <div className="mt-3 text-caption text-label-2">{updatedAt ? `Updated ${dayjs(updatedAt).fromNow()}` : 'Not synced yet'}</div>
    </Card>
  );
}

function MemberHistory({ doc }: { doc: AppData }) {
  const today = useToday();
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<GoalKind | null>(null);
  const kinds = useMemo(() => kindsSeen(doc), [doc]);
  return (
    <>
      <StreakHeader data={doc} today={today} />
      <MuscleMap data={doc} today={today} />
      <Calendar data={doc} today={today} selected={day} onSelect={setDay} filter={filter} kinds={kinds} />
      <FilterChips kinds={kinds} value={filter} onChange={setFilter} />
      <DayCard data={doc} date={day} />
    </>
  );
}
