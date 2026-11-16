import { create } from 'zustand';
import type { PlanAnswers, TemplateId } from '@/domain/plan';

/** Welcome, Body, Goal, Daily life, Calories, Experience, Schedule, Equipment, Focus, Result. */
export const LAST_STEP = 9;

export type Draft = Partial<PlanAnswers> & { units?: 'kg' | 'lb' };

interface OnboardingStore {
  step: number;
  answers: Draft;
  /** Another template picked from "Other options"; null means the default for the day count. */
  template: TemplateId | null;
  set: (patch: Draft) => void;
  setTemplate: (t: TemplateId | null) => void;
  next: () => void;
  back: () => void;
  start: (answers: Draft, step?: number) => void;
  reset: () => void;
}

/** In-progress answers. Never persisted: nothing reaches AppData until the user finishes. */
export const useOnboarding = create<OnboardingStore>()((set) => ({
  step: 0,
  answers: {},
  template: null,
  set: (patch) => set((s) => ({ answers: { ...s.answers, ...patch } })),
  setTemplate: (template) => set({ template }),
  next: () => set((s) => ({ step: Math.min(LAST_STEP, s.step + 1) })),
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
  start: (answers, step = 0) => set({ answers, step, template: null }),
  reset: () => set({ step: 0, answers: {}, template: null }),
}));
