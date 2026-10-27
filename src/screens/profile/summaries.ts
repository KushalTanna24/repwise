import dayjs from 'dayjs';
import { ALL_EQUIPMENT } from '@/domain/catalogue';
import { activeRuns } from '@/domain/challenges';
import { currentLeave } from '@/domain/leave';
import { SPLITS } from '@/domain/splits';
import type { AppData } from '@/domain/types';
import type { Permission } from '@/lib/notify';

export type ProfileRow = 'training' | 'goals' | 'challenges' | 'leave' | 'body' | 'supps' | 'equipment' | 'reminders' | 'data';

/** One-line value shown on each Profile row, so the list says what is set without opening anything. */
export function profileSummaries(data: AppData, ctx: { permission: Permission; signedIn: boolean; today?: string }): Record<ProfileRow, string> {
  const p = data.profile;
  const split = data.program.splitId ? SPLITS[data.program.splitId] : null;
  const rotation = split ? split.sessions.map((s) => s.title.split(' ').pop()).join('/') : '';
  const goals = data.goals.length;
  const stack = data.supplements.filter((s) => !s.archived).length;
  const on = ALL_EQUIPMENT.filter((k) => p.equipment.includes(k)).length;
  const leave = currentLeave(data, ctx.today ?? dayjs().format('YYYY-MM-DD'));
  const runs = activeRuns(data).length;
  return {
    training: split ? `${split.name} ${rotation} · ${p.daysPerWeek}×/wk` : 'Not set',
    goals: goals ? `${goals} ${goals === 1 ? 'goal' : 'goals'}` : 'None yet',
    challenges: runs ? `${runs} active` : 'None',
    leave: !leave ? 'Off' : leave.end ? `On until ${dayjs(leave.end).format('D MMM')}` : 'On',
    body: `${p.waterGoal} glasses`,
    supps: stack ? `${stack} in stack` : 'Empty',
    equipment: on === ALL_EQUIPMENT.length ? 'All equipment' : `${on} of ${ALL_EQUIPMENT.length}`,
    reminders: p.waterReminders?.on ? 'Water on' : ctx.permission === 'granted' ? 'On' : ctx.permission === 'denied' ? 'Blocked' : 'Off',
    data: `${data.sessions.length} workouts`,
  };
}
