-- MathDoc Row Level Security. Run after 002_functions.sql.
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
