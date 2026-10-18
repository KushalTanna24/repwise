import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { isEmpty } from '@/domain/migrate';
import type { AppData } from '@/domain/types';
import { useApp } from '@/store/app';
import { resolveSync } from './resolve';
import { parseHash } from '@/lib/routeParse';
import { useRoute } from '@/lib/route';
import { supabase, TABLE } from './client';
import { isNetworkError, launchAuth, onAuthEvent, stripAuthParams } from './authUrl';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface SyncState {
  user: User | null;
  status: SyncStatus;
  message: string | null;
  lastSyncedAt: string | null;
  /** True after the first successful pull; pushes wait for it so a stale device never overwrites the cloud blind. */
  ready: boolean;
  retry: () => void;
  /** One-off message for the top banner. */
  notice: { kind: 'signed-in'; email: string } | { kind: 'link-error'; message: string } | null;
  clearNotice: () => void;
}

export const useSyncState = create<SyncState>(() => ({
  user: null,
  status: 'local',
  message: null,
  lastSyncedAt: null,
  ready: false,
  retry: () => {},
  notice: null,
  clearNotice: () => useSyncState.setState({ notice: null }),
}));

const PUSH_DELAY_MS = 1500;

async function pull(userId: string) {
  const { data, error } = await supabase.from(TABLE).select('workout_data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return { doc: (data?.workout_data as unknown) ?? null };
}

async function push(userId: string, doc: AppData) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, workout_data: doc, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Mount once. Owns auth listening, the initial pull and debounced pushes. */
export function useSyncEngine() {
  const user = useSyncState((s) => s.user);
  const ready = useSyncState((s) => s.ready);
  const hydrated = useApp((s) => s.hydrated);
  const updatedAt = useApp((s) => s.data.meta.updatedAt);

  useEffect(() => {
    const viaLink = launchAuth?.kind === 'session';
    if (launchAuth?.kind === 'error') {
      useSyncState.setState({ notice: { kind: 'link-error', message: launchAuth.message } });
      history.replaceState(null, '', stripAuthParams(location.href));
      useRoute.setState(parseHash(location.hash));
    }

    // Adopt a user and, when it is news, tell them.
    const adopt = (next: User | null, notice: boolean) => {
      useSyncState.setState({
        user: next,
        ready: false,
        status: next ? 'syncing' : 'local',
        message: null,
        ...(notice && next && { notice: { kind: 'signed-in' as const, email: next.email ?? '' } }),
      });
    };

    // INITIAL_SESSION replaces a separate getSession() read, so the link's own SIGNED_IN stays news.
    let initialHandled = false;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const prev = useSyncState.getState().user;
      const next = session?.user ?? null;
      const r = onAuthEvent({ prev, next, event, viaLink, initialHandled });
      initialHandled = r.initialHandled;
      if (next?.id !== prev?.id) adopt(next, r.notice);
    });

    // A sign-in finished in another tab (e.g. Chrome while this is the installed app) shows up in storage.
    const recheck = () => {
      if (useSyncState.getState().user) return;
      void supabase.auth.getSession().then(({ data: d }) => {
        const found = d.session?.user ?? null;
        if (found && !useSyncState.getState().user) adopt(found, true);
      });
    };
    const onVisible = () => document.visibilityState === 'visible' && recheck();
    const onStorage = (e: StorageEvent) => e.key?.startsWith('sb-') && recheck();
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('storage', onStorage);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('storage', onStorage);
    };
  }, []);

  const cloud = useQuery({
    queryKey: ['cloud', user?.id],
    queryFn: () => pull(user!.id),
    enabled: !!user && hydrated,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (doc: AppData) => push(user!.id, doc),
    onMutate: () => useSyncState.setState({ status: 'syncing' }),
    onSuccess: () => useSyncState.setState({ status: 'synced', message: null, lastSyncedAt: new Date().toISOString() }),
    onError: () => useSyncState.setState({ status: 'error', message: "Couldn't back up. Your data is safe on this phone." }),
  });

  // Resolve each fetch result exactly once.
  const resolvedAt = useRef(0);
  useEffect(() => {
    if (!user) return;
    if (cloud.isError && cloud.errorUpdatedAt !== resolvedAt.current) {
      resolvedAt.current = cloud.errorUpdatedAt;
      useSyncState.setState({ status: 'error', message: "Couldn't reach the cloud. Your data is safe on this phone." });
      return;
    }
    if (!cloud.isSuccess || cloud.dataUpdatedAt === resolvedAt.current) return;
    resolvedAt.current = cloud.dataUpdatedAt;
    const local = useApp.getState().data;
    const r = resolveSync(local, { ok: true, doc: cloud.data.doc }, new Date().toISOString());
    if (r.action === 'error') {
      useSyncState.setState({ status: 'error', message: 'The cloud copy is unreadable, so it was left alone.' });
      return;
    }
    if (r.action === 'take') {
      if (!isEmpty(local)) {
        try {
          localStorage.setItem('repwise_v4_before_cloud', JSON.stringify(local));
        } catch {
          /* best effort */
        }
      }
      useApp.getState().replace(r.data);
    }
    useSyncState.setState({ ready: true });
    if (r.action === 'push') mutation.mutate(r.data);
    else useSyncState.setState({ status: 'synced', lastSyncedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cloud.isError, cloud.isSuccess, cloud.dataUpdatedAt, cloud.errorUpdatedAt]);

  // Debounced backup after local changes.
  useEffect(() => {
    if (!user || !ready) return;
    const t = setTimeout(() => mutation.mutate(useApp.getState().data), PUSH_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt, user, ready]);

  // Latest handles in a ref so the published retry() never goes stale and is set once.
  const handles = useRef({ ready, mutate: mutation.mutate, refetch: cloud.refetch });
  handles.current = { ready, mutate: mutation.mutate, refetch: cloud.refetch };
  useEffect(() => {
    useSyncState.setState({
      retry: () => (handles.current.ready ? handles.current.mutate(useApp.getState().data) : void handles.current.refetch()),
    });
  }, []);
}

export async function signIn(email: string): Promise<{ message: string; network: boolean } | null> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
  return error ? { message: error.message, network: isNetworkError(error, navigator.onLine) } : null;
}

export async function signOut() {
  await supabase.auth.signOut();
  useSyncState.setState({ user: null, status: 'local', ready: false, message: null });
}
