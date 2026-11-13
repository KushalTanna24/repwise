-- Security checks for the groups migration. Run against a branch or local database after `supabase db push`:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/groups_check.sql
-- Everything happens in one transaction that rolls back. Any failed check raises and stops the script.
begin;

-- Three people: dad and mom share a group; stranger is in none.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'dad@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'mom@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f1', 'stranger@test.local', 'authenticated', 'authenticated');
insert into public.repwise_user_data (user_id, workout_data) values
  ('00000000-0000-0000-0000-0000000000a1', '{"profile":{"daysPerWeek":3,"heightCm":165,"targetWeightKg":60,"sex":"female","birthYear":1968,"activity":"feet","bodyGoal":"lose","intakeKcal":1800,"goalNote":"x","displayName":"Mom elsewhere"},"bodyweights":[{"id":"w","date":"2026-11-01","kg":70}],"photos":[{"id":"p","date":"2026-11-01","path":"00000000-0000-0000-0000-0000000000a1/p.jpg"}],"fasts":[{"id":"f"}],"supplements":[{"id":"s"}],"suppLog":{"2026-11-01":["s"]},"exerciseNotes":{"squat":{"think":"brace"}},"sessions":[],"water":{"2026-11-01":5},"activeSession":{"startedAt":"2026-11-13T05:00:00Z","exercises":[{"exerciseId":"bench","sets":[{"actualKg":40}]}]}}');

create temp table ctx (k text primary key, v text) on commit drop;
grant all on ctx to authenticated;

-- Dad creates a group (body sharing on for him); mom joins without sharing body data.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
insert into ctx select 'group', (public.create_group('Family', 'Dad', true)).id::text;
insert into ctx select 'code', invite_code from public.groups where id = (select v::uuid from ctx where k = 'group');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select public.join_group((select v from ctx where k = 'code'), 'Mom', false);

-- 1. Body data and private fields are stripped when mom's share_body is off.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
do $$
declare r jsonb := public.member_doc((select v::uuid from ctx where k = 'group'), '00000000-0000-0000-0000-0000000000a1');
declare k text;
begin
  if r ->> 'share_body' <> 'false' then raise exception 'FAIL share_body flag'; end if;
  foreach k in array array['heightCm','targetWeightKg','sex','birthYear','activity','bodyGoal','intakeKcal','goalNote','displayName'] loop
    if r -> 'doc' -> 'profile' ? k then raise exception 'FAIL profile.% leaked', k; end if;
  end loop;
  foreach k in array array['bodyweights','photos','fasts','supplements'] loop
    if jsonb_array_length(r -> 'doc' -> k) <> 0 then raise exception 'FAIL % leaked', k; end if;
  end loop;
  if r -> 'doc' -> 'suppLog' <> '{}'::jsonb then raise exception 'FAIL suppLog leaked'; end if;
  if r -> 'doc' -> 'exerciseNotes' <> '{}'::jsonb then raise exception 'FAIL exerciseNotes leaked'; end if;
  if jsonb_array_length(r -> 'doc' -> 'activeSession' -> 'exercises' -> 0 -> 'sets') <> 0 then raise exception 'FAIL active sets leaked'; end if;
  if (r -> 'doc' -> 'water' ->> '2026-11-01') <> '5' then raise exception 'FAIL water should stay'; end if;
  raise notice 'PASS member_doc strips body data when sharing is off';
end $$;

-- 2. A stranger gets nothing.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
do $$
begin
  begin
    perform public.member_doc((select v::uuid from ctx where k = 'group'), '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL stranger read member_doc';
  exception when insufficient_privilege then raise notice 'PASS non-member member_doc refused';
  end;
  if exists (select 1 from public.groups) or exists (select 1 from public.group_members) then raise exception 'FAIL stranger sees groups'; end if;
  raise notice 'PASS non-member sees no groups or members';
end $$;

-- 3. Members cannot write nudges directly.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
do $$
begin
  begin
    insert into public.nudges (group_id, from_user, to_user, preset, delivery)
      values ((select v::uuid from ctx where k = 'group'), '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'keep', 'push');
    raise exception 'FAIL direct nudge insert allowed';
  exception when insufficient_privilege then raise notice 'PASS direct nudge insert refused';
  end;
end $$;

-- 4. A member cannot promote themselves or edit someone else's row.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$
begin
  begin
    update public.group_members set role = 'owner' where user_id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FAIL role update allowed';
  exception when insufficient_privilege then raise notice 'PASS role is not client-writable';
  end;
  update public.group_members set share_body = true where user_id = '00000000-0000-0000-0000-0000000000d1';
  if (select share_body from public.group_members where user_id = '00000000-0000-0000-0000-0000000000d1') is not true then raise exception 'FAIL setup'; end if;
  update public.group_members set display_name = 'Hacked' where user_id = '00000000-0000-0000-0000-0000000000d1';
  if (select display_name from public.group_members where user_id = '00000000-0000-0000-0000-0000000000d1') = 'Hacked' then raise exception 'FAIL edited another member'; end if;
  raise notice 'PASS members edit only their own row';
end $$;

-- 5. Removing a member rotates the invite code.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
do $$
declare before text := (select v from ctx where k = 'code');
begin
  perform public.remove_member((select v::uuid from ctx where k = 'group'), '00000000-0000-0000-0000-0000000000a1');
  if (select invite_code from public.groups where id = (select v::uuid from ctx where k = 'group')) = before then raise exception 'FAIL code not rotated'; end if;
  raise notice 'PASS remove_member rotates the invite code';
end $$;

-- 6. The 13th member is refused.
reset role;
do $$
declare g uuid := (select v::uuid from ctx where k = 'group');
begin
  insert into auth.users (id, email, aud, role)
    select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'x' || i || '@test.local', 'authenticated', 'authenticated' from generate_series(1, 12) i;
  insert into public.group_members (group_id, user_id, display_name)
    select g, ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'M' || i from generate_series(1, 11) i;
end $$;
-- Dad plus 11 others makes 12 (mom was removed above).
do $$
declare code text := (select invite_code from public.groups where id = (select v::uuid from ctx where k = 'group'));
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000112","role":"authenticated"}', true);
  begin
    perform public.join_group(code, 'Thirteen', false);
    raise exception 'FAIL 13th member joined';
  exception when sqlstate 'P0001' then raise notice 'PASS 13th join refused';
  end;
end $$;

-- 7. The reminders cron never selects a nudge-only device.
do $$
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, tz, kinds)
    values ('00000000-0000-0000-0000-0000000000d1', 'https://push.example/nudge-only', 'p', 'a', 'UTC', '{nudges}');
  if exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example/nudge-only' and kinds @> '{reminders}') then
    raise exception 'FAIL nudge-only device matches reminders';
  end if;
  raise notice 'PASS kinds filter separates reminders from nudges';
end $$;

rollback;
