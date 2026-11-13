import { create } from 'zustand';
import type { PlanAnswers, PlanResultV2 } from '@/domain/plan';

export const STEP = {
  welcome: 0,
  body: 1,
  goal: 2,
  tape: 3,
  daily: 4,
  calories: 5,
  experience: 6,
  schedule: 7,
  equipment: 8,
  focus: 9,
  style: 10,
  result: 11,
} as const;
export const LAST_STEP = STEP.result;

export type Draft = Partial<PlanAnswers> & { units?: 'kg' | 'lb' };

interface OnboardingStore {
  step: number;
  answers: Draft;
  /** Seed for this run; the same answers rebuild the same first plan. */
  seed: number;
  /** Plans reached with Regenerate after the first, newest last. */
  history: PlanResultV2[];
  /** Exercise picks of plans shown since the cycle last started over. */
  shown: string[][][];
  set: (patch: Draft) => void;
  next: () => void;
  back: () => void;
  start: (answers: Draft, step?: number) => void;
  reset: () => void;
  /** Records a regenerated plan; `shown` is what it was generated against. */
  regenerated: (r: PlanResultV2, shown: string[][][]) => void;
  backPlan: () => void;
}

/** The tape step only applies to the look goal. */
const skips = (step: number, answers: Draft) => step === STEP.tape && answers.goal !== 'look';
const newSeed = () => Math.floor(Math.random() * 1e9);

/** In-progress answers. Never persisted: nothing reaches AppData until the user finishes. */
export const useOnboarding = create<OnboardingStore>()((set) => ({
  step: 0,
  answers: {},
  seed: newSeed(),
  history: [],
  shown: [],
  set: (patch) => set((s) => ({ answers: { ...s.answers, ...patch }, history: [], shown: [] })),
  next: () =>
    set((s) => {
      let step = Math.min(LAST_STEP, s.step + 1);
      if (skips(step, s.answers)) step += 1;
      return { step };
    }),
  back: () =>
    set((s) => {
      let step = Math.max(0, s.step - 1);
      if (skips(step, s.answers)) step -= 1;
      return { step };
    }),
  start: (answers, step = 0) => set({ answers, step, seed: newSeed(), history: [], shown: [] }),
  reset: () => set({ step: 0, answers: {}, history: [], shown: [] }),
  regenerated: (r, shown) => set((s) => ({ history: [...s.history, r], shown: r.exhausted ? [r.picks] : [...shown, r.picks] })),
  backPlan: () => set((s) => ({ history: s.history.slice(0, -1) })),
}));
