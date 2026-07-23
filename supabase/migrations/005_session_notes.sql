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
