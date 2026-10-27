import type { ChallengeRun } from './types';

export type ChallengeDraft = Pick<ChallengeRun, 'templateId' | 'title' | 'days' | 'rule' | 'tasks' | 'anchor'>;

export const HABIT_STACK_DAYS = [21, 30, 66] as const;

/** Never call it "75 Hard"; that name is a trademark. */
export function seventyFiveDraft(): ChallengeDraft {
  return {
    templateId: '75-day',
    title: '75-Day Challenge',
    days: 75,
    rule: 'strict',
    tasks: [
      { id: 'workout', label: 'Workout 45 min', kind: 'tick', auto: 'workout' },
      { id: 'outdoor', label: 'Outdoor workout 45 min', kind: 'tick', auto: 'workout-outdoor' },
      { id: 'water', label: 'Drink 3.7 L', kind: 'tick', auto: 'water', target: 15 },
      { id: 'diet', label: 'Follow your diet', kind: 'tick' },
      { id: 'alcohol', label: 'No alcohol', kind: 'tick' },
      { id: 'read', label: 'Read 10 pages', kind: 'tick' },
      { id: 'photo', label: 'Progress photo', kind: 'photo' },
    ],
  };
}

export function habitStackDraft(anchor: string, habits: string[], days: (typeof HABIT_STACK_DAYS)[number]): ChallengeDraft {
  return {
    templateId: 'habit-stack',
    title: 'Habit stack',
    days,
    rule: 'lenient',
    anchor,
    tasks: habits.map((label, i) => ({ id: `h${i + 1}`, label, kind: 'tick' as const })),
  };
}
