-- =====================================================================
-- MathDOC - FULL Supabase setup.
-- Paste this WHOLE file into the Supabase SQL Editor and click RUN.
-- Safe to re-run: the reset block below first removes any existing
-- MathDOC tables (and their data) so you always get a clean install.
-- Generated from supabase/migrations/*.sql + seed.sql
-- =====================================================================

-- ============ RESET (drops existing MathDOC objects) ============
drop table if exists session_notes, certificates, proof_submissions, tasks,
  invoices, appointments, availability_slots, mcq_attempts, mcq_questions,
  settings, profiles cascade;
drop type if exists user_role, slot_mode, appointment_mode,
  appointment_status, invoice_status, task_type, task_status,
  proof_status, slot_status cascade;
drop function if exists handle_new_user() cascade;
drop function if exists is_admin() cascade;
drop function if exists set_updated_at() cascade;

-- ============ supabase\migrations\001_schema.sql ============
-- MathDOC schema. Run this first in the Supabase SQL editor.
create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type user_role as enum ('admin', 'student');
create type slot_mode as enum ('physical', 'online', 'either');
create type appointment_mode as enum ('physical', 'online');
create type appointment_status as enum ('pending_payment', 'confirmed', 'completed', 'cancelled');
create type invoice_status as enum ('unpaid', 'paid', 'bypassed');
create type task_type as enum ('task', 'meet_sir');
create type task_status as enum ('locked', 'active', 'proof_submitted', 'approved');
create type proof_status as enum ('pending', 'accepted', 'rejected');
create type slot_status as enum ('free', 'booked');

-- ---------- updated_at helper ----------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Tables ----------

-- One row per auth user (created automatically by trigger in 002).
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'student',
  full_name text,
  phone text unique,
  school text,
  grade text,
  guardian_name text,
  guardian_phone text,
  address text,
  category text,
  mcq_score integer,
  mcq_total integer,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Simple admin-manageable settings (appointment price etc.)
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- Placement exam questions (built by the teacher in the admin panel)
create table mcq_questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  options jsonb not null,               -- array of option strings
  correct_index integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mcq_questions_updated_at before update on mcq_questions
  for each row execute function set_updated_at();

create table mcq_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  answers jsonb not null,               -- { question_id: chosen_index }
  score integer not null,
  total integer not null,
  submitted_at timestamptz not null default now()
);
create index mcq_attempts_student_idx on mcq_attempts (student_id);

-- Teacher's free time slots
create table availability_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode slot_mode not null default 'either',
  status slot_status not null default 'free',
  created_at timestamptz not null default now(),
  constraint slot_times_valid check (ends_at > starts_at)
);
create index availability_slots_starts_idx on availability_slots (starts_at);
create index availability_slots_status_idx on availability_slots (status);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  slot_id uuid not null references availability_slots (id),
  mode appointment_mode not null,
  status appointment_status not null default 'pending_payment',
  meeting_link text,
  diagnosis_notes text,
  price numeric(10, 2) not null default 0,
  is_follow_up boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live appointment per slot (cancelled ones release the slot for rebooking)
create unique index appointments_slot_active_uidx on appointments (slot_id)
  where status <> 'cancelled';
create index appointments_student_idx on appointments (student_id);
create index appointments_status_idx on appointments (status);
create trigger appointments_updated_at before update on appointments
  for each row execute function set_updated_at();

create table invoices (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  amount numeric(10, 2) not null,
  status invoice_status not null default 'unpaid',
  issued_at timestamptz not null default now()
);
create index invoices_token_idx on invoices (public_token);

-- The task "mini-game": ordered tasks assigned after an appointment
create table tasks (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  sort_order integer not null default 0,
  type task_type not null default 'task',
  title text not null,
  description text not null,
  attachment_key text,                  -- R2 object key (PDF/image from the teacher)
  status task_status not null default 'active',
  follow_up_appointment_id uuid references appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_appointment_idx on tasks (appointment_id, sort_order);
create index tasks_student_idx on tasks (student_id);
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

create table proof_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  file_keys jsonb not null,             -- array of R2 object keys
  student_note text,
  status proof_status not null default 'pending',
  teacher_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index proof_submissions_task_idx on proof_submissions (task_id);
create index proof_submissions_status_idx on proof_submissions (status);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  issued_at timestamptz not null default now()
);
create index certificates_student_idx on certificates (student_id);

-- ============ supabase\migrations\002_functions.sql ============
-- MathDOC functions & triggers. Run after 001_schema.sql.

-- True when the current session belongs to the teacher/admin.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profiles row for every new auth user (OTP signups and
-- dashboard-created admin users alike).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, phone, role)
  values (
    new.id,
    case when new.phone is not null and new.phone <> '' then '+' || new.phone end,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Atomically book a slot for the logged-in student.
-- Regular booking: creates a pending_payment appointment + unpaid invoice.
-- Follow-up ("Meet with Sir" checkpoint): free, auto-confirmed, no invoice,
-- and linked to the checkpoint task.
create or replace function book_appointment(
  p_slot_id uuid,
  p_mode appointment_mode,
  p_follow_up_task_id uuid default null
)
returns table (appointment_id uuid, invoice_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_slot availability_slots%rowtype;
  v_price numeric(10, 2);
  v_appointment_id uuid;
  v_invoice_token text;
  v_task tasks%rowtype;
begin
  if v_student is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Lock the slot row so two students can't book it at the same time.
  select * into v_slot from availability_slots
    where id = p_slot_id for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;
  if v_slot.status <> 'free' then
    raise exception 'SLOT_TAKEN';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'SLOT_IN_PAST';
  end if;
  if v_slot.mode <> 'either' and v_slot.mode::text <> p_mode::text then
    raise exception 'MODE_NOT_AVAILABLE';
  end if;

  if p_follow_up_task_id is not null then
    select * into v_task from tasks
      where id = p_follow_up_task_id
        and student_id = v_student
        and type = 'meet_sir';
    if not found then
      raise exception 'TASK_NOT_FOUND';
    end if;
    v_price := 0;
  else
    select coalesce(
      (select value::numeric from settings where key = 'appointment_price'),
      2000
    ) into v_price;
  end if;

  update availability_slots set status = 'booked' where id = p_slot_id;

  insert into appointments (student_id, slot_id, mode, status, price, is_follow_up)
  values (
    v_student,
    p_slot_id,
    p_mode,
    case when p_follow_up_task_id is not null then 'confirmed'::appointment_status
         else 'pending_payment'::appointment_status end,
    v_price,
    p_follow_up_task_id is not null
  )
  returning id into v_appointment_id;

  if p_follow_up_task_id is not null then
    update tasks set follow_up_appointment_id = v_appointment_id
      where id = p_follow_up_task_id;
  else
    insert into invoices (appointment_id, amount)
    values (v_appointment_id, v_price)
    returning public_token into v_invoice_token;
  end if;

  return query select v_appointment_id, v_invoice_token;
end;
$$;

revoke execute on function book_appointment(uuid, appointment_mode, uuid) from public, anon;
grant execute on function book_appointment(uuid, appointment_mode, uuid) to authenticated;

-- ============ supabase\migrations\003_rls.sql ============
-- MathDOC Row Level Security. Run after 002_functions.sql.
-- Principle: students only ever see/touch their own rows; the teacher
-- (is_admin()) has full access; sensitive writes (grading, payment bypass,
-- task state, certificates) happen server-side via the service role, which
-- bypasses RLS *after* explicit ownership checks in code.

alter table profiles enable row level security;
alter table settings enable row level security;
alter table mcq_questions enable row level security;
alter table mcq_attempts enable row level security;
alter table availability_slots enable row level security;
alter table appointments enable row level security;
alter table invoices enable row level security;
alter table tasks enable row level security;
alter table proof_submissions enable row level security;
alter table certificates enable row level security;

-- ---------- profiles ----------
create policy "profiles: own read" on profiles
  for select using (id = auth.uid() or is_admin());
-- Students never write profiles directly: registration/profile edits go
-- through a validated server action (service role). Admin edits categories.
create policy "profiles: admin write" on profiles
  for update using (is_admin()) with check (is_admin());
create policy "profiles: admin delete" on profiles
  for delete using (is_admin());

-- ---------- settings ----------
create policy "settings: authenticated read" on settings
  for select using (auth.uid() is not null);
create policy "settings: admin write" on settings
  for all using (is_admin()) with check (is_admin());

-- ---------- mcq_questions ----------
-- Students never read this table directly (correct_index lives here);
-- the exam server action serves questions without answers.
create policy "mcq_questions: admin all" on mcq_questions
  for all using (is_admin()) with check (is_admin());

-- ---------- mcq_attempts ----------
create policy "mcq_attempts: own read" on mcq_attempts
  for select using (student_id = auth.uid() or is_admin());
-- Inserted server-side after grading (service role) — no client insert.

-- ---------- availability_slots ----------
create policy "slots: authenticated read" on availability_slots
  for select using (auth.uid() is not null);
create policy "slots: admin write" on availability_slots
  for insert with check (is_admin());
create policy "slots: admin update" on availability_slots
  for update using (is_admin()) with check (is_admin());
create policy "slots: admin delete" on availability_slots
  for delete using (is_admin());

-- ---------- appointments ----------
create policy "appointments: own read" on appointments
  for select using (student_id = auth.uid() or is_admin());
-- Created only via the book_appointment() function (security definer);
-- updated by admin or trusted server code.
create policy "appointments: admin write" on appointments
  for update using (is_admin()) with check (is_admin());
create policy "appointments: admin delete" on appointments
  for delete using (is_admin());

-- ---------- invoices ----------
create policy "invoices: own read" on invoices
  for select using (
    is_admin() or exists (
      select 1 from appointments a
      where a.id = invoices.appointment_id and a.student_id = auth.uid()
    )
  );
create policy "invoices: admin write" on invoices
  for update using (is_admin()) with check (is_admin());

-- ---------- tasks ----------
create policy "tasks: own read" on tasks
  for select using (student_id = auth.uid() or is_admin());
create policy "tasks: admin insert" on tasks
  for insert with check (is_admin());
create policy "tasks: admin update" on tasks
  for update using (is_admin()) with check (is_admin());
create policy "tasks: admin delete" on tasks
  for delete using (is_admin());

-- ---------- proof_submissions ----------
create policy "proofs: own read" on proof_submissions
  for select using (student_id = auth.uid() or is_admin());
-- A student may only submit proof for their OWN task that is currently ACTIVE.
create policy "proofs: student insert own active" on proof_submissions
  for insert with check (
    student_id = auth.uid() and exists (
      select 1 from tasks t
      where t.id = proof_submissions.task_id
        and t.student_id = auth.uid()
        and t.status = 'active'
    )
  );
create policy "proofs: admin update" on proof_submissions
  for update using (is_admin()) with check (is_admin());
create policy "proofs: admin delete" on proof_submissions
  for delete using (is_admin());

-- ---------- certificates ----------
create policy "certificates: own read" on certificates
  for select using (student_id = auth.uid() or is_admin());
-- Issued server-side (service role) when all tasks are approved.

-- ============ supabase\migrations\004_grants.sql ============
-- MathDOC access grants. Run after 003_rls.sql.
-- Supabase normally adds these automatically, but if tables were created
-- through a non-standard connection they can be missing — this makes it
-- explicit. RLS (003) still controls which ROWS each user can touch.

grant usage on schema public to authenticated, service_role;

-- The service role is trusted server code — full access (bypasses RLS anyway).
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Logged-in users: table-level access, with RLS deciding row visibility.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Future tables created by this role get the same grants automatically.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ============ supabase\migrations\005_session_notes.sql ============
-- MathDOC: session notes (added one by one during/after a session).
-- Run after 004_grants.sql.

create table if not exists session_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists session_notes_student_idx
  on session_notes (student_id, created_at desc);
create index if not exists session_notes_appointment_idx
  on session_notes (appointment_id);

alter table session_notes enable row level security;

-- Students read their own notes (they appear on their profile page);
-- only the teacher writes them.
drop policy if exists "session_notes: own read" on session_notes;
create policy "session_notes: own read" on session_notes
  for select using (student_id = auth.uid() or is_admin());

drop policy if exists "session_notes: admin write" on session_notes;
create policy "session_notes: admin write" on session_notes
  for all using (is_admin()) with check (is_admin());

grant select, insert, update, delete on session_notes to authenticated;
grant all privileges on session_notes to service_role;

-- ============ supabase\seed.sql ============
-- MathDOC sample data. Run after the migrations (optional but recommended for dev).

-- Backfill profiles for any auth users that were created BEFORE the
-- on_auth_user_created trigger existed (safe to re-run).
insert into profiles (id, phone, role)
select
  u.id,
  case when u.phone is not null and u.phone <> '' then '+' || u.phone end,
  'student'
from auth.users u
on conflict (id) do nothing;

-- Promote the teacher account to admin (username "sir" on the login page).
update profiles
set role = 'admin', full_name = 'Sir', profile_completed = true
where id in (select id from auth.users where email = 'sir@mathdoc.local');

insert into settings (key, value) values
  ('appointment_price', '2000'),
  ('payments_enabled', 'false'),              -- pricing/payment step hidden until the gateway is ready
  ('location', 'No. 12, Temple Road, Kandy')  -- shown in SMS for physical meetings
on conflict (key) do update set value = excluded.value;

-- NOTE: kept deliberately ASCII-only. Special characters (pi, degree signs,
-- ellipses) get mangled when this file is copied through tools that assume
-- a non-UTF-8 encoding. Type them directly in the admin panel instead.
insert into mcq_questions (text, options, correct_index, sort_order) values
  ('What is the value of 3x when x = 4?',
   '["7", "12", "34", "1"]', 1, 1),
  ('The angle in a semicircle is always...',
   '["45 degrees", "60 degrees", "90 degrees", "180 degrees"]', 2, 2),
  ('Solve: 2x + 6 = 14',
   '["x = 4", "x = 10", "x = 7", "x = 2"]', 0, 3),
  ('The circumference of a circle with radius r is...',
   '["pi * r^2", "2 * pi * r", "pi * d^2", "r^2 / 2"]', 1, 4),
  ('If a triangle has angles 50 and 60 degrees, the third angle is...',
   '["70 degrees", "80 degrees", "90 degrees", "60 degrees"]', 0, 5);

-- Sample free slots for the next 7 days (4pm & 5pm daily)
insert into availability_slots (starts_at, ends_at, mode)
select
  d + time '16:00',
  d + time '17:00',
  'either'
from generate_series(
  current_date + 1,
  current_date + 7,
  interval '1 day'
) as d;

insert into availability_slots (starts_at, ends_at, mode)
select
  d + time '17:00',
  d + time '18:00',
  'online'
from generate_series(
  current_date + 1,
  current_date + 7,
  interval '1 day'
) as d;


-- ============ Phase 2, Slice 2: richer tasks + default-task templates ============
-- (Same as migrations/007_phase2_task_media.sql — safe to re-run.)

alter table tasks add column if not exists is_priority boolean not null default false;
alter table tasks add column if not exists timer_seconds integer;
alter table tasks add column if not exists due_at timestamptz;
alter table tasks add column if not exists media_type text;
alter table tasks add column if not exists media_url text;
alter table tasks add column if not exists media_key text;
alter table tasks add column if not exists question_image_key text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_media_type_check') then
    alter table tasks add constraint tasks_media_type_check
      check (media_type is null or media_type in ('youtube', 'facebook', 'video', 'voice'));
  end if;
end $$;

alter table proof_submissions add column if not exists time_spent_seconds integer;

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
  if not exists (select 1 from pg_trigger where tgname = 'default_tasks_updated_at') then
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

do $$ begin
  if not exists (select 1 from default_tasks) then
    insert into default_tasks (title, description, type, is_priority, timer_seconds, sort_order) values
      ('Revise today''s topic', 'Read through your notes from today and rewrite the key steps in your own words.', 'task', false, null, 1),
      ('Practice set: 10 questions', 'Complete 10 practice questions on the topic we covered. Show all your working.', 'task', false, null, 2),
      ('Timed past-paper section', 'Attempt the attached past-paper section. Start the timer when you begin and stop it when you finish.', 'task', true, 3600, 3),
      ('Meet with Sir', 'A quick check-in to review your progress so far.', 'meet_sir', false, null, 4);
  end if;
end $$;
