import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GroupsUi {
  /** The group the Groups tab shows; null means the first one. */
  selectedGroupId: string | null;
  select(id: string | null): void;
}

// A per-device convenience only; losing it just shows the first group.
const safeLocal = () => {
  try {
    return localStorage;
  } catch {
    return undefined as unknown as Storage;
  }
};

export const useGroupsUi = create<GroupsUi>()(
  persist((set) => ({ selectedGroupId: null, select: (id) => set({ selectedGroupId: id }) }), {
    name: 'repwise_groups_ui',
    storage: createJSONStorage(safeLocal),
    partialize: (s) => ({ selectedGroupId: s.selectedGroupId }),
  }),
);
