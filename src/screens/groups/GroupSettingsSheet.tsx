import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ellipsis } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { List, Row, SectionHeader } from '@/components/ui/card';
import { FieldRow, Switch, TextInput } from '@/components/ui/field';
import { Menu } from '@/components/ui/menu';
import { confirm } from '@/components/ui/alert';
import {
  groupErrorMessage,
  useGroupMembers,
  useLeaveGroup,
  useRemoveMember,
  useRenameGroup,
  useRotateInvite,
  useSelectedGroup,
  useUpdateMyMembership,
} from '@/lib/groups';
import { disablePush, enablePush, pushKindOn, pushSupported } from '@/lib/push';
import { reminderToggle } from '@/lib/pushUtil';
import { toast } from '@/lib/toast';
import { useSyncState } from '@/sync/useSync';
import { shareInvite } from './share';

/** Settings for the group shown on the tab: invite, your name, body sharing, nudges, members, leave. */
export function GroupSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const group = useSelectedGroup();
  const uid = useSyncState((s) => s.user?.id ?? null);
  const members = useGroupMembers(open ? (group?.id ?? null) : null);
  const update = useUpdateMyMembership();
  const rename = useRenameGroup();
  const rotate = useRotateInvite();
  const remove = useRemoveMember();
  const leave = useLeaveGroup();
  const qc = useQueryClient();
  const nudgesOn = useQuery({ queryKey: ['push-kind', 'nudges'], queryFn: () => pushKindOn('nudges'), enabled: open });
  const [groupName, setGroupName] = useState('');
  const [me, setMe] = useState('');
  const owner = group?.role === 'owner';

  useEffect(() => {
    if (open && group) {
      setGroupName(group.name);
      setMe(group.displayName);
    }
  }, [open, group?.id, group?.name, group?.displayName]);

  if (!group) return <Sheet open={open} onClose={onClose} title="Group"><p className="py-10 text-center text-subhead text-label-2">No group selected.</p></Sheet>;
  const g = group;

  const run = async (p: Promise<unknown>, done?: string) => {
    try {
      await p;
      if (done) toast(done);
    } catch (e) {
      toast(groupErrorMessage(e));
    }
  };

  function saveGroupName() {
    const n = groupName.trim();
    if (!n || n === g.name) return setGroupName(g.name);
    void run(rename.mutateAsync({ groupId: g.id, name: n }), 'Group renamed');
  }

  function saveMe() {
    const n = me.trim();
    if (!n || n === g.displayName) return setMe(g.displayName);
    void run(update.mutateAsync({ groupId: g.id, displayName: n }), 'Name updated');
  }

  async function newCode() {
    const ok = await confirm({ title: 'Make a new invite code?', message: 'Links and codes you already shared stop working.', confirmLabel: 'New code' });
    if (ok) void run(rotate.mutateAsync(g.id), 'New code ready');
  }

  async function toggleNudges(next: boolean) {
    if (next) {
      const { message } = reminderToggle(await enablePush(uid, 'nudges'));
      toast(message ?? 'Nudges on for this phone');
    } else {
      await disablePush('nudges');
      toast('Nudges off for this phone');
    }
    void qc.invalidateQueries({ queryKey: ['push-kind'] });
  }

  async function removeMember(userId: string, name: string) {
    const ok = await confirm({ title: `Remove ${name}?`, message: 'They stop seeing the group, and the invite code changes so the old link no longer works.', confirmLabel: 'Remove', destructive: true });
    if (ok) void run(remove.mutateAsync({ groupId: g.id, userId }), `${name} removed`);
  }

  async function leaveGroup() {
    const others = (members.data ?? []).filter((m) => m.userId !== uid);
    const next = owner && others.length ? others[0].displayName : null;
    const ok = await confirm({
      title: `Leave ${g.name}?`,
      message: others.length === 0 ? "You're the last one here, so the group is deleted." : next ? `${next} becomes the owner. You can rejoin with a new invite.` : 'You can rejoin with a new invite.',
      confirmLabel: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    await run(leave.mutateAsync(g.id), 'You left the group');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={g.name} right={<Button variant="plain" size="sm" className="font-bold" onClick={onClose}>Done</Button>}>
      <div className="pb-6">
        <SectionHeader title="Invite" />
        <List>
          <Row title="Share invite link" onClick={() => void shareInvite(g.name, g.inviteCode)} chevron />
          <Row title="Invite code" value={<span className="font-mono tracking-widest">{g.inviteCode}</span>} />
          {owner && <Row title="Make a new code" subtitle="Old links stop working" onClick={() => void newCode()} />}
        </List>

        <SectionHeader title="You" />
        <List>
          {owner && (
            <FieldRow label="Group name">
              <TextInput value={groupName} maxLength={40} onChange={(e) => setGroupName(e.target.value)} onBlur={saveGroupName} className="w-40" aria-label="Group name" />
            </FieldRow>
          )}
          <FieldRow label="Your name here">
            <TextInput value={me} maxLength={24} onChange={(e) => setMe(e.target.value)} onBlur={saveMe} className="w-32" aria-label="Your name in this group" />
          </FieldRow>
          <FieldRow label="Share body data" hint="Weight, BMI, photos, fasting and supplements">
            <Switch
              checked={g.shareBody}
              onChange={(v) => void run(update.mutateAsync({ groupId: g.id, shareBody: v }), v ? 'Body data shared with this group' : 'Body data hidden from this group')}
              label="Share body data with this group"
            />
          </FieldRow>
          {pushSupported() && (
            <FieldRow label="Nudges on this phone" hint="At most twice a day, never at night">
              <Switch checked={!!nudgesOn.data} onChange={(v) => void toggleNudges(v)} label="Nudges on this phone" />
            </FieldRow>
          )}
        </List>

        <SectionHeader title={`Members · ${members.data?.length ?? '…'}`} />
        <List>
          {members.isPending && <Row title="Loading members…" />}
          {members.isError && <Row title="Couldn't load members" subtitle="Tap to retry" onClick={() => void members.refetch()} />}
          {(members.data ?? []).map((m) => (
            <div key={m.userId} className="flex items-center [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep">
              <Row className="flex-1" title={m.userId === uid ? `${m.displayName} (you)` : m.displayName} subtitle={m.role === 'owner' ? 'Owner' : undefined} />
              {owner && m.userId !== uid && (
                <div className="pr-3">
                  <Menu
                    label={`Options for ${m.displayName}`}
                    trigger={
                      <Button variant="plain" size="icon" aria-label={`Options for ${m.displayName}`}>
                        <Ellipsis className="size-5" />
                      </Button>
                    }
                    items={[{ label: 'Remove from group', onSelect: () => void removeMember(m.userId, m.displayName), destructive: true }]}
                  />
                </div>
              )}
            </div>
          ))}
        </List>

        <List className="mt-6">
          <Row title="Leave group" destructive onClick={() => void leaveGroup()} />
        </List>
      </div>
    </Sheet>
  );
}
