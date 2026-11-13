-- Groups: members see each other's training, compete on a weekly board and send nudges.
-- Spec: docs/superpowers/specs/2026-11-13-groups-design.md

-- Push devices say which pushes they accept, so nudges and reminders are independent opt-ins.
alter table public.push_subscriptions add column if not exists kinds text[] not null default '{reminders}';
alter table public.push_subscriptions drop constraint if exists push_subscriptions_kinds_known;
alter table public.push_subscriptions add constraint push_subscriptions_kinds_known check (kinds <@ array['reminders', 'nudges']::text[]);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  invite_code text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  role text not null default 'member' check (role in ('owner', 'member')),
  share_body boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  from_user uuid not null references auth.users on delete cascade,
  to_user uuid not null references auth.users on delete cascade,
  preset text,
  note text check (note is null or char_length(note) <= 80),
  delivery text not null check (delivery in ('push', 'quiet', 'cheer', 'capped')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index nudges_to_idx on public.nudges (to_user, created_at desc);
create index nudges_from_idx on public.nudges (from_user, created_at desc);

-- Membership check used by policies; security definer so a policy on group_members never recurses into itself.
create or replace function public.is_member(g uuid, u uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from group_members where group_id = g and user_id = u) $$;

create or replace function public.is_owner(g uuid, u uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from group_members where group_id = g and user_id = u and role = 'owner') $$;

-- Six characters people can read aloud and type: no 0/O, 1/I/L.
create or replace function public.gen_invite_code() returns text
  language plpgsql volatile set search_path = public
  as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end $$;

-- RLS -----------------------------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.nudges enable row level security;

revoke all on table public.groups, public.group_members, public.nudges from anon, public;
grant select on table public.groups, public.group_members, public.nudges to authenticated;
grant update (name) on table public.groups to authenticated;
grant update (display_name, share_body) on table public.group_members to authenticated;
grant update (read_at) on table public.nudges to authenticated;

create policy "members read their groups" on public.groups
  for select to authenticated using (public.is_member(id, (select auth.uid())));
create policy "owner renames the group" on public.groups
  for update to authenticated using (public.is_owner(id, (select auth.uid()))) with check (public.is_owner(id, (select auth.uid())));

create policy "members read co-members" on public.group_members
  for select to authenticated using (public.is_member(group_id, (select auth.uid())));
create policy "members edit their own row" on public.group_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "read nudges sent or received" on public.nudges
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
create policy "receiver marks nudges read" on public.nudges
  for update to authenticated using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));
-- No insert policy: only the group-nudge edge function (service role) writes nudges.

-- RPCs ----------------------------------------------------------------------------------------------
create or replace function public.create_group(p_name text, p_display_name text, p_share_body boolean)
  returns public.groups language plpgsql security definer set search_path = public
  as $$
declare
  uid uuid := auth.uid();
  g groups;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  loop
    begin
      insert into groups (name, invite_code, created_by) values (btrim(p_name), gen_invite_code(), uid) returning * into g;
      exit;
    exception when unique_violation then
      -- Code collision: draw again.
    end;
  end loop;
  insert into group_members (group_id, user_id, display_name, role, share_body)
    values (g.id, uid, btrim(p_display_name), 'owner', coalesce(p_share_body, false));
  return g;
end $$;

create or replace function public.join_group(p_code text, p_display_name text, p_share_body boolean)
  returns public.groups language plpgsql security definer set search_path = public
  as $$
declare
  uid uuid := auth.uid();
  g groups;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  -- Locks the group so two joins can't both take the 12th place.
  select * into g from groups where invite_code = upper(btrim(p_code)) for update;
  if not found then raise exception 'no_group' using errcode = 'P0002'; end if;
  if exists (select 1 from group_members where group_id = g.id and user_id = uid) then return g; end if;
  if (select count(*) from group_members where group_id = g.id) >= 12 then raise exception 'group_full' using errcode = 'P0001'; end if;
  insert into group_members (group_id, user_id, display_name, role, share_body)
    values (g.id, uid, btrim(p_display_name), 'member', coalesce(p_share_body, false));
  return g;
end $$;

create or replace function public.leave_group(p_group uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
declare
  uid uuid := auth.uid();
  was_owner boolean;
begin
  delete from group_members where group_id = p_group and user_id = uid returning role = 'owner' into was_owner;
  if not found then return; end if;
  if not exists (select 1 from group_members where group_id = p_group) then
    delete from groups where id = p_group;
  elsif was_owner then
    update group_members set role = 'owner'
      where group_id = p_group and user_id = (select user_id from group_members where group_id = p_group order by joined_at, user_id limit 1);
  end if;
end $$;

create or replace function public.rotate_invite(p_group uuid)
  returns text language plpgsql security definer set search_path = public
  as $$
declare code text;
begin
  if not is_owner(p_group, auth.uid()) then raise exception 'not_owner' using errcode = '42501'; end if;
  loop
    begin
      update groups set invite_code = gen_invite_code() where id = p_group returning invite_code into code;
      return code;
    exception when unique_violation then
    end;
  end loop;
end $$;

-- Removing someone also changes the code, so the link they had can't bring them back.
create or replace function public.remove_member(p_group uuid, p_member uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
begin
  if not is_owner(p_group, auth.uid()) then raise exception 'not_owner' using errcode = '42501'; end if;
  if p_member = auth.uid() then raise exception 'use_leave' using errcode = 'P0001'; end if;
  delete from group_members where group_id = p_group and user_id = p_member;
  perform rotate_invite(p_group);
end $$;

-- A member's document as this group may see it. Keep the stripped keys in step with src/domain/groups/privacy.ts.
create or replace function public.member_doc(p_group uuid, p_member uuid)
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
declare
  share boolean;
  doc jsonb;
  upd timestamptz;
  ex jsonb;
begin
  if not is_member(p_group, auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
  select share_body into share from group_members where group_id = p_group and user_id = p_member;
  if not found then raise exception 'not_member' using errcode = '42501'; end if;

  select workout_data, updated_at into doc, upd from repwise_user_data where user_id = p_member;
  if doc is null or jsonb_typeof(doc) <> 'object' then
    return jsonb_build_object('doc', null, 'updated_at', upd, 'share_body', share);
  end if;

  -- Always private: personal exercise notes and the name used in other groups.
  doc := (doc - 'exerciseNotes') || jsonb_build_object('exerciseNotes', '{}'::jsonb);
  doc := jsonb_set(doc, '{profile}', coalesce(doc -> 'profile', '{}'::jsonb) - 'displayName');

  if not share then
    doc := doc || jsonb_build_object('bodyweights', '[]'::jsonb, 'photos', '[]'::jsonb, 'fasts', '[]'::jsonb, 'supplements', '[]'::jsonb, 'suppLog', '{}'::jsonb);
    doc := jsonb_set(doc, '{profile}', (doc -> 'profile') - array['heightCm', 'targetWeightKg', 'sex', 'birthYear', 'activity', 'bodyGoal', 'intakeKcal', 'goalNote']);
  end if;

  -- A live workout shows as "training now" without its half-typed sets.
  if jsonb_typeof(doc -> 'activeSession') = 'object' and jsonb_typeof(doc -> 'activeSession' -> 'exercises') = 'array' then
    select coalesce(jsonb_agg(e || '{"sets": []}'::jsonb), '[]'::jsonb) into ex from jsonb_array_elements(doc -> 'activeSession' -> 'exercises') e;
    doc := jsonb_set(doc, '{activeSession,exercises}', ex);
  end if;

  return jsonb_build_object('doc', doc, 'updated_at', upd, 'share_body', share);
end $$;

revoke all on function public.is_member(uuid, uuid), public.is_owner(uuid, uuid), public.gen_invite_code(),
  public.create_group(text, text, boolean), public.join_group(text, text, boolean), public.leave_group(uuid),
  public.rotate_invite(uuid), public.remove_member(uuid, uuid), public.member_doc(uuid, uuid) from public, anon;
grant execute on function public.is_member(uuid, uuid), public.is_owner(uuid, uuid),
  public.create_group(text, text, boolean), public.join_group(text, text, boolean), public.leave_group(uuid),
  public.rotate_invite(uuid), public.remove_member(uuid, uuid), public.member_doc(uuid, uuid) to authenticated;
