create table if not exists public.learning_hub_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint learning_hub_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.learning_hub_state enable row level security;

revoke all on table public.learning_hub_state from anon, public;
grant select, insert, update on table public.learning_hub_state to authenticated;

drop policy if exists "Users can read their learning hub state" on public.learning_hub_state;
create policy "Users can read their learning hub state"
  on public.learning_hub_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their learning hub state" on public.learning_hub_state;
create policy "Users can create their learning hub state"
  on public.learning_hub_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their learning hub state" on public.learning_hub_state;
create policy "Users can update their learning hub state"
  on public.learning_hub_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
