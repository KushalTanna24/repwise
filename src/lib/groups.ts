// Every Supabase call for groups. Query keys all start with 'groups' so sign-out can drop them in one go.
// Member documents live only in this in-memory cache: never in IndexedDB, Zustand or the sync path.
import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/sync/client';
import { useSyncState } from '@/sync/useSync';
import { normalize } from '@/domain/migrate';
import { stripForGroup } from '@/domain/groups/privacy';
import type { AppData } from '@/domain/types';
import { act } from '@/store/app';
import { useGroupsUi } from '@/store/groups';
import { go, openSheet } from './route';
import { pendingJoin } from './pendingJoin';

export interface GroupSummary { id: string; name: string; inviteCode: string; role: 'owner' | 'member'; shareBody: boolean; displayName: string }
export interface Member { userId: string; displayName: string; role: 'owner' | 'member'; shareBody: boolean; joinedAt: string }
export interface MemberDoc { doc: AppData | null; updatedAt: string | null; shareBody: boolean }
export type Delivery = 'push' | 'quiet' | 'cheer' | 'capped';
export type PresetId = 'keep' | 'missed' | 'proud' | 'today';
export interface Nudge { id: string; groupId: string; groupName: string; fromUser: string; fromName: string; preset: PresetId | null; note: string | null; delivery: Delivery; createdAt: string; readAt: string | null }

/** Same lines as supabase/functions/group-nudge/run.ts. */
export const PRESETS: Record<PresetId, string> = {
  keep: 'Keep pushing 💪',
  missed: 'Missed you at the gym',
  proud: 'Proud of you',
  today: "Let's train today",
};
export const NOTE_MAX = 80;
export const GROUP_MAX = 12;

const useUid = () => useSyncState((s) => s.user?.id ?? null);

/** Turns a Supabase or function error into words for a toast. */
export function groupErrorMessage(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (msg.includes('no_group')) return "That code doesn't match a group";
  if (msg.includes('group_full')) return `This group is full (${GROUP_MAX} people)`;
  if (msg.includes('not_owner')) return 'Only the group owner can do that';
  if (/fetch|network/i.test(msg)) return "You're offline. Try again when you're connected.";
  return msg && !msg.includes('_') ? msg : 'Something went wrong. Try again.';
}

// Reads --------------------------------------------------------------------------------------------

export function useMyGroups() {
  const uid = useUid();
  return useQuery({
    queryKey: ['groups', 'mine', uid],
    enabled: !!uid,
    queryFn: async (): Promise<GroupSummary[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, share_body, display_name, joined_at, groups(id, name, invite_code)')
        .eq('user_id', uid!)
        .order('joined_at');
      if (error) throw error;
      return (data ?? []).flatMap((r) => {
        const g = r.groups as unknown as { id: string; name: string; invite_code: string } | null;
        return g ? [{ id: g.id, name: g.name, inviteCode: g.invite_code, role: r.role as GroupSummary['role'], shareBody: !!r.share_body, displayName: r.display_name as string }] : [];
      });
    },
  });
}

/** The group the tab shows: the remembered one if still a member, else the first. */
export function useSelectedGroup(): GroupSummary | null {
  const groups = useMyGroups().data ?? [];
  const selected = useGroupsUi((s) => s.selectedGroupId);
  return groups.find((g) => g.id === selected) ?? groups[0] ?? null;
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['groups', 'members', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.from('group_members').select('user_id, display_name, role, share_body, joined_at').eq('group_id', groupId!).order('joined_at');
      if (error) throw error;
      return (data ?? []).map((r) => ({ userId: r.user_id, displayName: r.display_name, role: r.role, shareBody: !!r.share_body, joinedAt: r.joined_at }));
    },
  });
}

async function fetchMemberDoc(groupId: string, userId: string): Promise<MemberDoc> {
  const { data, error } = await supabase.rpc('member_doc', { p_group: groupId, p_member: userId });
  if (error) throw error;
  const r = data as { doc: unknown; updated_at: string | null; share_body: boolean };
  const doc = r.doc ? normalize(r.doc, new Date().toISOString()) : null;
  // The server already stripped it; doing it again here means a server slip never reaches the screen.
  return { doc: doc && stripForGroup(doc, r.share_body), updatedAt: r.updated_at, shareBody: r.share_body };
}

const memberDocQuery = (groupId: string, userId: string) => ({
  queryKey: ['groups', 'doc', groupId, userId],
  queryFn: () => fetchMemberDoc(groupId, userId),
  staleTime: 60_000,
  refetchOnWindowFocus: true,
});

export function useMemberDoc(groupId: string | null, userId: string | null) {
  return useQuery({ ...memberDocQuery(groupId ?? '', userId ?? ''), enabled: !!groupId && !!userId });
}

/** Every member's document for the scoreboard, fetched in parallel. */
export function useMemberDocs(groupId: string | null, userIds: string[]) {
  return useQueries({ queries: userIds.map((u) => ({ ...memberDocQuery(groupId ?? '', u), enabled: !!groupId })) });
}

export function useMemberPhotos(groupId: string, userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['groups', 'photos', groupId, userId],
    enabled,
    // Links last 5 minutes; refetch before they expire and never keep them past that.
    staleTime: 240_000,
    gcTime: 240_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.functions.invoke('member-photos', { body: { group: groupId, member: userId } });
      if (error) throw error;
      return (data as { urls?: Record<string, string> }).urls ?? {};
    },
  });
}

/** Names of everyone in the viewer's groups, keyed by group then user. Used to label nudges. */
function useDirectory() {
  const uid = useUid();
  return useQuery({
    queryKey: ['groups', 'directory', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('group_members').select('group_id, user_id, display_name, groups(name)');
      if (error) throw error;
      const names = new Map<string, string>();
      const groupNames = new Map<string, string>();
      for (const r of data ?? []) {
        names.set(`${r.group_id}:${r.user_id}`, r.display_name as string);
        groupNames.set(r.group_id as string, (r.groups as unknown as { name: string } | null)?.name ?? '');
      }
      return { names, groupNames };
    },
  });
}

export function useNudges() {
  const uid = useUid();
  const dir = useDirectory();
  const q = useQuery({
    queryKey: ['groups', 'nudges', uid],
    enabled: !!uid,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nudges')
        .select('id, group_id, from_user, preset, note, delivery, created_at, read_at')
        .eq('to_user', uid!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const nudges: Nudge[] = (q.data ?? []).map((r) => ({
    id: r.id,
    groupId: r.group_id,
    groupName: dir.data?.groupNames.get(r.group_id) ?? '',
    fromUser: r.from_user,
    fromName: dir.data?.names.get(`${r.group_id}:${r.from_user}`) ?? 'A former member',
    preset: r.preset,
    note: r.note,
    delivery: r.delivery,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));
  return { ...q, nudges, unreadCount: nudges.filter((n) => !n.readAt).length };
}

/** Members the viewer already nudged today (viewer's day; the server enforces the receiver's day). */
export function useSentToday() {
  const uid = useUid();
  return useQuery({
    queryKey: ['groups', 'sent-today', uid],
    enabled: !!uid,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('nudges').select('to_user').eq('from_user', uid!).gte('created_at', dayjs().startOf('day').toISOString());
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.to_user as string));
    },
  });
}

// Writes -------------------------------------------------------------------------------------------

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['groups'] });
}

/** The name a person last used, kept in their own document only to prefill the next form. */
function rememberName(name: string) {
  const n = name.trim();
  act((d) => (d.profile.displayName === n ? d : { ...d, profile: { ...d.profile, displayName: n } }));
}

export function useCreateGroup() {
  const invalidate = useInvalidate();
  const select = useGroupsUi((s) => s.select);
  return useMutation({
    mutationFn: async (v: { name: string; displayName: string; shareBody: boolean }) => {
      const { data, error } = await supabase.rpc('create_group', { p_name: v.name.trim(), p_display_name: v.displayName.trim(), p_share_body: v.shareBody });
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (g, v) => {
      rememberName(v.displayName);
      select(g.id);
      void invalidate();
    },
  });
}

export function useJoinGroup() {
  const invalidate = useInvalidate();
  const select = useGroupsUi((s) => s.select);
  return useMutation({
    mutationFn: async (v: { code: string; displayName: string; shareBody: boolean }) => {
      const { data, error } = await supabase.rpc('join_group', { p_code: v.code.trim().toUpperCase(), p_display_name: v.displayName.trim(), p_share_body: v.shareBody });
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (g, v) => {
      rememberName(v.displayName);
      select(g.id);
      void invalidate();
    },
  });
}

export function useLeaveGroup() {
  const invalidate = useInvalidate();
  const select = useGroupsUi((s) => s.select);
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc('leave_group', { p_group: groupId });
      if (error) throw error;
    },
    onSuccess: () => {
      select(null);
      void invalidate();
    },
  });
}

export function useRemoveMember() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { groupId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_member', { p_group: v.groupId, p_member: v.userId });
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });
}

export function useRotateInvite() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await supabase.rpc('rotate_invite', { p_group: groupId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => void invalidate(),
  });
}

export function useRenameGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { groupId: string; name: string }) => {
      const { error } = await supabase.from('groups').update({ name: v.name.trim() }).eq('id', v.groupId);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateMyMembership() {
  const uid = useUid();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { groupId: string; displayName?: string; shareBody?: boolean }) => {
      const patch: Record<string, unknown> = {};
      if (v.displayName !== undefined) patch.display_name = v.displayName.trim();
      if (v.shareBody !== undefined) patch.share_body = v.shareBody;
      const { error } = await supabase.from('group_members').update(patch).eq('group_id', v.groupId).eq('user_id', uid!);
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      if (v.displayName) rememberName(v.displayName);
      void invalidate();
    },
  });
}

export function useSendNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { group: string; to: string; preset?: PresetId; note?: string }): Promise<Delivery> => {
      const { data, error } = await supabase.functions.invoke('group-nudge', { body: v });
      if (error) {
        // Function errors carry the server's words in the response body.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error((body as { error?: string } | null)?.error ?? groupErrorMessage(error));
      }
      return (data as { delivery: Delivery }).delivery;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['groups', 'sent-today'] }),
  });
}

export function useMarkNudgesRead() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('nudges').update({ read_at: new Date().toISOString() }).eq('to_user', uid!).is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['groups', 'nudges'] }),
  });
}

// Session ------------------------------------------------------------------------------------------

/**
 * Mounted once in the shell. A different user (or sign-out) drops every cached group read, so one
 * account never sees another's members. After a sign-in, an invite opened while signed out reopens.
 */
export function useGroupsSession() {
  const uid = useUid();
  const qc = useQueryClient();
  useEffect(() => {
    qc.removeQueries({ queryKey: ['groups'] });
    if (!uid) return;
    const code = pendingJoin.take();
    if (code) {
      go('groups');
      openSheet(`join:${code}`);
    }
  }, [uid, qc]);
}
