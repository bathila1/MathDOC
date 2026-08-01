-- MathDOC — Web Push subscriptions (browser push notifications). Run after 013.
-- One row per browser/device a user has allowed push on. The server sends push
-- messages (via web-push + VAPID) to every subscription of a notification's
-- recipient. Dead endpoints are pruned by the server on 404/410.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'push_subscriptions' and policyname = 'push: own all'
  ) then
    create policy "push: own all" on push_subscriptions
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on push_subscriptions to authenticated;
grant all privileges on push_subscriptions to service_role;
