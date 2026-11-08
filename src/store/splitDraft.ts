import { create } from 'zustand';
import type { CustomSplit, DayFocus } from '@/domain/training';

/** UI draft state only. Not persisted; server data never lives here. */
interface SplitDraftStore {
  draft: CustomSplit | null;
  dirty: boolean;
  focus: Record<number, DayFocus>;
  open: (split: CustomSplit) => void;
  edit: (fn: (s: CustomSplit) => CustomSplit) => void;
  setFocus: (day: number, f: DayFocus) => void;
  close: () => void;
}

export const useSplitDraft = create<SplitDraftStore>()((set) => ({
  draft: null,
  dirty: false,
  focus: {},
  open: (split) => set({ draft: split, dirty: false, focus: {} }),
  edit: (fn) =>
    set((s) => {
      if (!s.draft) return s;
      const next = fn(s.draft);
      return next === s.draft ? s : { draft: next, dirty: true };
    }),
  setFocus: (day, f) => set((s) => ({ focus: { ...s.focus, [day]: f } })),
  close: () => set({ draft: null, dirty: false, focus: {} }),
}));
