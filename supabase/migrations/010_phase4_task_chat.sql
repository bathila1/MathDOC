-- MathDOC Phase 4 — Slice 4: task-scoped real-time chat. Run after 009.

create table if not exists task_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  sender_role text not null check (sender_role in ('student', 'admin')),
  body text not null default '',
  image_key text,
  created_at timestamptz not null default now()
);
create index if not exists task_messages_task_idx
  on task_messages (task_id, created_at);

alter table task_messages enable row level security;

-- Read: the teacher, or the student who owns the task.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'task_messages' and policyname = 'task_messages: read own'
  ) then
    create policy "task_messages: read own" on task_messages
      for select using (
        is_admin() or exists (
          select 1 from tasks t
          where t.id = task_messages.task_id and t.student_id = auth.uid()
        )
      );
  end if;
end $$;

-- Write: you can only post as yourself, with the correct role, on a task you
-- own (student) or any task (admin).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'task_messages' and policyname = 'task_messages: insert own'
  ) then
    create policy "task_messages: insert own" on task_messages
      for insert with check (
        sender_id = auth.uid() and (
          (is_admin() and sender_role = 'admin')
          or (
            sender_role = 'student' and exists (
              select 1 from tasks t
              where t.id = task_messages.task_id and t.student_id = auth.uid()
            )
          )
        )
      );
  end if;
end $$;

grant select, insert on task_messages to authenticated;
grant all privileges on task_messages to service_role;

-- Deliver INSERTs over Supabase Realtime (RLS still filters what each client sees).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'task_messages'
     ) then
    alter publication supabase_realtime add table task_messages;
  end if;
end $$;
