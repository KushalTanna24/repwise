import { Bell, Database, Dumbbell, HeartPulse, Pill, Plane, SlidersHorizontal, Target, Trophy, type LucideIcon } from 'lucide-react';
import { streak } from '@/domain/streak';
import { Flame } from '@/components/Flame';
import { useToday } from '@/lib/useToday';
import { Screen } from '@/components/Screen';
import { List, Row } from '@/components/ui/card';
import { openSheet } from '@/lib/route';
import { useNotifyPermission } from '@/lib/notify';
import { useData } from '@/store/app';
import { useSyncState } from '@/sync/useSync';
import { SignInCard } from './profile/SignInCard';
import { profileSummaries, type ProfileRow } from './profile/summaries';

const ROWS: { id: ProfileRow; title: string; icon: LucideIcon }[] = [
  { id: 'training', title: 'Training plan', icon: SlidersHorizontal },
  { id: 'goals', title: 'Goals', icon: Target },
  { id: 'challenges', title: 'Challenges', icon: Trophy },
  { id: 'leave', title: 'Leave', icon: Plane },
  { id: 'body', title: 'Body & water', icon: HeartPulse },
  { id: 'supps', title: 'Supplements', icon: Pill },
  { id: 'equipment', title: 'Equipment & exercises', icon: Dumbbell },
  { id: 'reminders', title: 'Reminders', icon: Bell },
  { id: 'data', title: 'Your data', icon: Database },
];

export function Profile() {
  const data = useData();
  const permission = useNotifyPermission((s) => s.permission);
  const user = useSyncState().user;
  const today = useToday();
  const summaries = profileSummaries(data, { permission, signedIn: !!user, today });
  const s = streak(data, today);
  return (
    <Screen title="Profile">
      <SignInCard />
      {s.current > 0 && (
        <div className="flex items-center gap-2 px-4 pt-3 text-subhead text-label-2">
          <Flame lit size={16} /> {s.current}-day streak
        </div>
      )}
      <div className="mt-6">
        <List>
          {ROWS.map(({ id, title, icon: Icon }) => (
            <Row
              key={id}
              leading={<Icon className="size-5 shrink-0 text-blue" />}
              title={title}
              value={summaries[id]}
              onClick={() => openSheet(id === 'supps' || id === 'challenges' || id === 'leave' ? id : `profile:${id}`)}
              chevron
            />
          ))}
        </List>
      </div>
      <p className="py-6 text-center text-caption text-label-3">Repwise {__APP_VERSION__}</p>
    </Screen>
  );
}
