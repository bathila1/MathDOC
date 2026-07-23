-- MathDOC Phase 2 — Slice 2: richer tasks + reusable default-task templates.
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
