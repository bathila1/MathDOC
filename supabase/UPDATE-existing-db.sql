-- MathDOC - catch-up updates for an EXISTING Supabase database (Phase 2 to 4).
-- NON-DESTRUCTIVE and safe to re-run: every statement is guarded (if not exists).
-- Paste this whole file into the Supabase SQL editor and press Run.
-- It adds every column/table the Phase 2 to 4 features need.

-- ======================= 006_phase2_settings_unlock.sql =======================
-- MathDOC Phase 2 â€” Slice 1: payments toggle + unlocked tasks.
-- Run after 005_session_notes.sql in the Supabase SQL editor.

-- Payments are OFF for now (the pricing/payment step is hidden until the
-- gateway is added). Toggle this from the admin Settings tab.
insert into settings (key, value)
values ('payments_enabled', 'false')
on conflict (key) do nothing;

-- Nothing is locked anymore: a student can attempt any task in any order.
-- Normalise any existing 'locked' rows so they show as open, and make new
-- tasks default to 'active' (the 'locked' enum value is kept for old data).
update tasks set status = 'active' where status = 'locked';
alter table tasks alter column status set default 'active';


-- ======================= 007_phase2_task_media.sql =======================
-- MathDOC Phase 2 â€” Slice 2: richer tasks + reusable default-task templates.
-- Run after 006_phase2_settings_unlock.sql in the Supabase SQL editor.

-- ---------- Task capabilities ----------
alter table tasks add column if not exists is_priority boolean not null default false;
alter table tasks add column if not exists timer_seconds integer;      -- allotted time for a timed paper (null = untimed)
alter table tasks add column if not exists due_at timestamptz;         -- task expires after this (null = no expiry)
alter table tasks add column if not exists media_type text;            -- 'youtube' | 'facebook' | 'video' | 'voice' | null
alter table tasks add column if not exists media_url text;             -- original link for youtube/facebook embeds
alter table tasks add column if not exists media_key text;             -- R2 object key for an uploaded video / voice note
alter table tasks add column if not exists question_image_key text;    -- R2 object key: image shown AS the question

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_media_type_check') then
    alter table tasks add constraint tasks_media_type_check
      check (media_type is null or media_type in ('youtube', 'facebook', 'video', 'voice'));
  end if;
end $$;

-- Time the student spent on a timed task, sent to Sir with the proof.
alter table proof_submissions add column if not exists time_spent_seconds integer;

-- ---------- Reusable default tasks (templates) ----------
create table if not exists default_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  type task_type not null default 'task',
  is_priority boolean not null default false,
  timer_seconds integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'default_tasks_updated_at'
  ) then
    create trigger default_tasks_updated_at before update on default_tasks
      for each row execute function set_updated_at();
  end if;
end $$;

alter table default_tasks enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'default_tasks' and policyname = 'default_tasks: admin all'
  ) then
    create policy "default_tasks: admin all" on default_tasks
      for all using (is_admin()) with check (is_admin());
  end if;
end $$;

grant select, insert, update, delete on default_tasks to authenticated;
grant all privileges on default_tasks to service_role;

-- Starter templates (editable/removable under the Placement exam tab).
do $$ begin
  if not exists (select 1 from default_tasks) then
    insert into default_tasks (title, description, type, is_priority, timer_seconds, sort_order) values
      ('Revise today''s topic', 'Read through your notes from today and rewrite the key steps in your own words.', 'task', false, null, 1),
      ('Practice set: 10 questions', 'Complete 10 practice questions on the topic we covered. Show all your working.', 'task', false, null, 2),
      ('Timed past-paper section', 'Attempt the attached past-paper section. Start the timer when you begin and stop it when you finish.', 'task', true, 3600, 3),
      ('Meet with Sir', 'A quick check-in to review your progress so far.', 'meet_sir', false, null, 4);
  end if;
end $$;


-- ======================= 008_phase2_multi_media.sql =======================
-- MathDOC Phase 2 â€” Slice 2b: allow several media on one task (YouTube + Facebook
-- + uploaded video + voice note, in any combination). Run after 007.

alter table tasks add column if not exists youtube_url text;
alter table tasks add column if not exists facebook_url text;
alter table tasks add column if not exists video_key text;   -- R2 key for an uploaded video
alter table tasks add column if not exists voice_key text;   -- R2 key for a voice note

-- Carry over anything stored under the old single-media columns (007).
update tasks set youtube_url  = media_url where media_type = 'youtube' and media_url is not null and youtube_url is null;
update tasks set facebook_url = media_url where media_type = 'facebook' and media_url is not null and facebook_url is null;
update tasks set video_key    = media_key where media_type = 'video'    and media_key is not null and video_key is null;
update tasks set voice_key    = media_key where media_type = 'voice'    and media_key is not null and voice_key is null;


-- ======================= 009_phase3_activity_notes_flags.sql =======================
-- MathDOC Phase 3 â€” Slice 3: student flags, login activity, hidden Sir notes.
-- Run after 008 in the Supabase SQL editor.

-- ---------- Student self-assessment flag ----------
-- The student can raise "this is hard" / "I can't do this" and move on.
alter table tasks add column if not exists student_flag text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_student_flag_check') then
    alter table tasks add constraint tasks_student_flag_check
      check (student_flag is null or student_flag in ('hard', 'cant_do'));
  end if;
end $$;

-- ---------- Login activity ----------
alter table profiles add column if not exists last_login_at timestamptz;

create table if not exists login_activity (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists login_activity_student_idx
  on login_activity (student_id, created_at desc);

alter table login_activity enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'login_activity' and policyname = 'login_activity: admin read'
  ) then
    create policy "login_activity: admin read" on login_activity
      for select using (is_admin());
  end if;
end $$;
grant select, insert on login_activity to authenticated; -- rows are inserted via service role
grant all privileges on login_activity to service_role;

-- ---------- Hidden Sir-only task note ----------
-- Kept in its own table so a student can never read it (admin-only RLS);
-- students and teacher share the same Postgres role, so a column on `tasks`
-- would be visible to a direct student query.
create table if not exists task_sir_notes (
  task_id uuid primary key references tasks (id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'task_sir_notes_updated_at') then
    create trigger task_sir_notes_updated_at before update on task_sir_notes
      for each row execute function set_updated_at();
  end if;
end $$;
alter table task_sir_notes enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'task_sir_notes' and policyname = 'task_sir_notes: admin all'
  ) then
    create policy "task_sir_notes: admin all" on task_sir_notes
      for all using (is_admin()) with check (is_admin());
  end if;
end $$;
grant select, insert, update, delete on task_sir_notes to authenticated;
grant all privileges on task_sir_notes to service_role;


-- ======================= 010_phase4_task_chat.sql =======================
-- MathDOC Phase 4 â€” Slice 4: task-scoped real-time chat. Run after 009.

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

