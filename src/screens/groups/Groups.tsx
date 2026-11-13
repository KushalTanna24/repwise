import { Bell, Settings, Users } from 'lucide-react';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Card, Empty } from '@/components/ui/card';
import { Picker } from '@/components/ui/menu';
import { SignInCard } from '@/screens/profile/SignInCard';
import { useMyGroups, useNudges, useSelectedGroup } from '@/lib/groups';
import { openSheet } from '@/lib/route';
import { useGroupsUi } from '@/store/groups';
import { useSyncState } from '@/sync/useSync';
import { Scoreboard } from './Scoreboard';

/** The Groups tab: this week's board for the chosen group. */
export function Groups() {
  const user = useSyncState((s) => s.user);
  const groups = useMyGroups();
  const selected = useSelectedGroup();
  const select = useGroupsUi((s) => s.select);
  const { unreadCount } = useNudges();

  if (!user)
    return (
      <Screen title="Groups">
        <Card className="mt-3 p-4">
          <Users className="size-8 text-blue" />
          <p className="mt-2 text-body">Train with family or friends. See each other's workouts and cheer each other on.</p>
        </Card>
        <SignInCard />
      </Screen>
    );

  const action = groups.data?.length ? (
    <div className="flex items-center gap-1">
      <Button variant="plain" size="icon" className="relative" aria-label={unreadCount ? `Nudges, ${unreadCount} new` : 'Nudges'} onClick={() => openSheet('nudges')}>
        <Bell className="size-[22px]" />
        {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red ring-2 ring-bg" />}
      </Button>
      <Button variant="plain" size="icon" aria-label="Group settings" onClick={() => openSheet('group-settings')}>
        <Settings className="size-[22px]" />
      </Button>
    </div>
  ) : undefined;

  return (
    <Screen title="Groups" action={action}>
      {groups.isPending ? (
        <p className="py-10 text-center text-subhead text-label-2">Loading your group…</p>
      ) : groups.isError ? (
        <Card className="mt-3">
          <Empty title="Couldn't load your groups" body="Check your connection." action={<Button variant="tinted" onClick={() => void groups.refetch()}>Retry</Button>} />
        </Card>
      ) : !selected ? (
        <Card className="mt-3">
          <Empty
            icon={<Users className="size-12" />}
            title="Train together"
            body="Make a group for your family or gym friends. See each other's training, compete on a fair weekly board, and send a nudge when someone needs it."
            action={
              <div className="grid w-full gap-2">
                <Button size="lg" onClick={() => openSheet('group-new')}>Create a group</Button>
                <Button variant="plain" onClick={() => openSheet('join:')}>Join with a code</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          {groups.data!.length > 1 && (
            <div className="mt-3 flex items-center justify-between rounded-card bg-card px-4 py-2 shadow-card">
              <span className="text-subhead text-label-2">Group</span>
              <Picker label="Group" value={selected.id} onChange={(id) => select(id)} options={groups.data!.map((g) => ({ value: g.id, label: g.name }))} />
            </div>
          )}
          <Scoreboard group={selected} viewerId={user.id} />
          <div className="mt-6 flex justify-center gap-4">
            <Button variant="plain" size="sm" onClick={() => openSheet('group-new')}>New group</Button>
            <Button variant="plain" size="sm" onClick={() => openSheet('join:')}>Join with a code</Button>
          </div>
        </>
      )}
    </Screen>
  );
}
