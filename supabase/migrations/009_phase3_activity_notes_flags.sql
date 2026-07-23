-- MathDOC Phase 3 — Slice 3: student flags, login activity, hidden Sir notes.
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
