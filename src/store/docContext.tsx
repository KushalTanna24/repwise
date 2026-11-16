// Which document a History or Progress view shows. Without a provider it is the user's own, editable.
// The group member view wraps the same components with a member's document and readOnly, so nothing can write.
import { createContext, useContext, type ReactNode } from 'react';
import type { AppData } from '@/domain/types';
import { openSheet } from '@/lib/route';
import { useData } from './app';

interface DocValue {
  data: AppData;
  readOnly: boolean;
  openSession(id: string): void;
  /** Someone else's photos come as short-lived links keyed by path; undefined while loading or for your own. */
  photoUrls?: Record<string, string>;
}

const Ctx = createContext<Omit<DocValue, 'data'> & { data: AppData | null }>({ data: null, readOnly: false, openSession: (id) => openSheet(`session:${id}`) });

export function DocProvider({
  data,
  readOnly,
  onOpenSession,
  photoUrls,
  children,
}: {
  data: AppData;
  readOnly: boolean;
  onOpenSession?: (id: string) => void;
  photoUrls?: Record<string, string>;
  children: ReactNode;
}) {
  return <Ctx.Provider value={{ data, readOnly, photoUrls, openSession: onOpenSession ?? ((id) => openSheet(`session:${id}`)) }}>{children}</Ctx.Provider>;
}

export function useDoc(): DocValue {
  const ctx = useContext(Ctx);
  const own = useData();
  return { ...ctx, data: ctx.data ?? own };
}
