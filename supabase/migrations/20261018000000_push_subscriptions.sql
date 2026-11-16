create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy "own rows" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
