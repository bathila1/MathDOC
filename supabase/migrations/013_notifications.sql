-- MathDOC — in-app notifications (bell + side panel), delivered live over
-- Supabase Realtime. Run after 012.
-- Each row targets one recipient (user_id). Rows are inserted by trusted server
-- code (service role); recipients can read and mark their own as read.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications' and policyname = 'notifications: own read'
  ) then
    create policy "notifications: own read" on notifications
      for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications' and policyname = 'notifications: own update'
  ) then
    create policy "notifications: own update" on notifications
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

grant select, update on notifications to authenticated;
grant all privileges on notifications to service_role;

-- Deliver INSERTs over Realtime (RLS still limits each client to its own rows).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
