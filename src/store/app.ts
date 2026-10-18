import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { del, get, set } from 'idb-keyval';
import { emptyAppData } from '@/domain/catalogue';
import { ensurePlan } from '@/domain/planner';
import { normalize } from '@/domain/migrate';
import type { AppData } from '@/domain/types';

export const STORE_KEY = 'repwise_v4';

const idb: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
};

interface AppStore {
  data: AppData;
  hydrated: boolean;
  /** Run a pure domain transition. No-ops (same object back) don't touch the timestamp. */
  act: (fn: (d: AppData) => AppData) => void;
  /** Replace the whole document (import, cloud restore). Keeps its timestamp. */
  replace: (d: AppData) => void;
}

export const useApp = create<AppStore>()(
  persist(
    (setState) => ({
      data: emptyAppData(new Date().toISOString()),
      hydrated: false,
      act: (fn) =>
        setState((s) => {
          const next = fn(s.data);
          if (next === s.data) return s;
          return { data: ensurePlan({ ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } }) };
        }),
      replace: (d) => setState({ data: ensurePlan(d) }),
    }),
    {
      name: STORE_KEY,
      version: 4,
      storage: createJSONStorage(() => idb),
      partialize: (s) => ({ data: s.data }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppStore> | undefined;
        // normalize fills fields added after the document was saved (e.g. water).
        const saved = p?.data ? normalize(p.data, new Date().toISOString()) : null;
        return { ...current, data: ensurePlan(saved ?? current.data) };
      },
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

/** Shorthand for components: `const data = useData()`. */
export const useData = () => useApp((s) => s.data);
export const act = (fn: (d: AppData) => AppData) => useApp.getState().act(fn);
