-- MathDoc schema. Run this first in the Supabase SQL editor.
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
  status task_status not null default 'locked',
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
