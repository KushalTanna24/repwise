import { ALL_EQUIPMENT } from '@/domain/catalogue';
import { SPLITS } from '@/domain/splits';
import type { AppData } from '@/domain/types';
import type { Permission } from '@/lib/notify';

export type ProfileRow = 'training' | 'goals' | 'body' | 'supps' | 'equipment' | 'reminders' | 'data';

/** One-line value shown on each Profile row, so the list says what is set without opening anything. */
export function profileSummaries(data: AppData, ctx: { permission: Permission; signedIn: boolean }): Record<ProfileRow, string> {
  const p = data.profile;
  const split = data.program.splitId ? SPLITS[data.program.splitId] : null;
  const rotation = split ? split.sessions.map((s) => s.title.split(' ').pop()).join('/') : '';
  const goals = data.goals.length;
  const stack = data.supplements.filter((s) => !s.archived).length;
  const on = ALL_EQUIPMENT.filter((k) => p.equipment.includes(k)).length;
  return {
    training: split ? `${split.name} ${rotation} · ${p.daysPerWeek}×/wk` : 'Not set',
    goals: goals ? `${goals} ${goals === 1 ? 'goal' : 'goals'}` : 'None yet',
    body: `${p.waterGoal} glasses`,
    supps: stack ? `${stack} in stack` : 'Empty',
    equipment: on === ALL_EQUIPMENT.length ? 'All equipment' : `${on} of ${ALL_EQUIPMENT.length}`,
    reminders: ctx.permission === 'granted' ? 'On' : ctx.permission === 'denied' ? 'Blocked' : 'Off',
    data: `${data.sessions.length} workouts`,
  };
}
