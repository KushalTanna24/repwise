import { useMemo } from 'react';
import dayjs from 'dayjs';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Crown, UserPlus } from 'lucide-react';
import { scoreboard, type BoardRow } from '@/domain/groups/scoreboard';
import { Rings } from '@/components/Rings';
import { Flame } from '@/components/Flame';
import { Button } from '@/components/ui/button';
import { Card, Empty, List } from '@/components/ui/card';
import { useGroupMembers, useMemberDocs, type GroupSummary } from '@/lib/groups';
import { openSheet } from '@/lib/route';
import { cn } from '@/lib/cn';
import { NudgeButton } from './NudgeButton';
import { shareInvite } from './share';

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;

/** This week's board: workouts against each person's own target, then streak. Never kilos. */
export function Scoreboard({ group, viewerId }: { group: GroupSummary; viewerId: string }) {
  const members = useGroupMembers(group.id);
  const ids = (members.data ?? []).map((m) => m.userId);
  const docs = useMemberDocs(group.id, ids);

  const loading = members.isPending || docs.some((d) => d.isPending);
  const failed = members.isError || docs.some((d) => d.isError);
  const docData = docs.map((d) => d.data);

  const rows = useMemo(() => {
    if (!members.data || docData.some((d) => !d)) return [];
    const now = new Date().toISOString();
    return scoreboard(
      members.data.map((m, i) => ({ userId: m.userId, name: m.displayName, doc: docData[i]?.doc ?? null })),
      now,
      dayjs().format('YYYY-MM-DD'),
    );
    // docData identity changes every render; the query timestamps are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.data, ...docs.map((d) => d.dataUpdatedAt)]);

  if (loading) return <p className="py-10 text-center text-subhead text-label-2">Loading your group…</p>;
  if (failed)
    return (
      <Card className="mt-3">
        <Empty
          title="Couldn't load the group"
          body="Check your connection."
          action={<Button variant="tinted" onClick={() => (void members.refetch(), docs.forEach((d) => void d.refetch()))}>Retry</Button>}
        />
      </Card>
    );

  const alone = rows.length === 1;
  const nobodyYet = rows.every((r) => r.done === 0);

  return (
    <>
      <div className="mt-4 flex items-baseline justify-between px-1">
        <h2 className="text-title3 font-bold">This week</h2>
        <span className="text-footnote text-label-2">{nobodyYet ? 'No one has trained this week yet' : 'Resets Monday'}</span>
      </div>
      <List className="mt-2">
        {rows.map((r) => (
          <BoardItem key={r.userId} row={r} groupId={group.id} me={r.userId === viewerId} />
        ))}
      </List>
      {alone && (
        <Card className="mt-3">
          <Empty
            icon={<UserPlus className="size-10" />}
            title="Just you so far"
            body="Invite family or friends to see each other's training and cheer each other on."
            action={<Button onClick={() => void shareInvite(group.name, group.inviteCode)}>Invite someone</Button>}
          />
        </Card>
      )}
      <p className="mt-3 px-1 text-footnote text-label-2">Ranked by workouts against each person's own weekly target, then streak. Strength change is against their own start.</p>
    </>
  );
}

function BoardItem({ row, groupId, me }: { row: BoardRow; groupId: string; me: boolean }) {
  const reduce = useReducedMotion();
  // The nudge button sits beside the tappable area, not inside it, so taps in its drawer never open this member.
  return (
    <motion.div
      layout={!reduce}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      className={cn('flex items-center gap-2 pr-4 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-sep', me && 'bg-blue/6')}
    >
    <button
      type="button"
      onClick={() => openSheet(`member:${groupId}:${row.userId}`)}
      aria-label={`Open ${row.name}'s training`}
      className="press flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
    >
      <span className="w-5 text-center text-headline font-bold tabular text-label-2">{row.rank}</span>
      <Rings rings={[{ value: row.done, max: Math.max(row.target, 1), color: '#34C759', label: 'Workouts this week' }]} size={36} stroke={5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-body font-semibold">{me ? `${row.name} (you)` : row.name}</span>
          {row.crown && <Crown className="size-4 shrink-0 text-orange" aria-label="Top of last week" />}
        </div>
        <div className="flex items-center gap-2 text-footnote tabular text-label-2">
          <span>
            {row.done} / {row.target}
          </span>
          {row.targetHit && (
            <span className="flex items-center gap-0.5 text-green">
              <Check className="size-3.5" strokeWidth={3} />
              Target hit
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Flame lit={row.streak > 0} size={14} />
            {row.streak}
          </span>
          <span aria-label="Strength change">{row.improvement == null ? '–' : pct(row.improvement)}</span>
        </div>
      </div>
    </button>
      {!me && <NudgeButton groupId={groupId} userId={row.userId} name={row.name} />}
    </motion.div>
  );
}
