  -- Creates the `session_notes` table.
  --
  -- WHY THIS EXISTS: 005_session_notes.sql was never applied to the live
  -- database. Verified by asking PostgREST directly — every other table the
  -- migrations define is present, `session_notes` is the only one missing, and
  -- the API even replies "Perhaps you meant the table 'public.task_sir_notes'".
  -- Those are two different tables and the app uses both:
  --   * task_sir_notes  — a private per-TASK note for the teacher (exists)
  --   * session_notes   — notes added during/after an APPOINTMENT (missing)
  --
  -- The symptom was "The notes table isn't visible to the API yet… NOTIFY pgrst".
  -- That message assumed a stale schema cache, which was the wrong diagnosis:
  -- reloading the cache cannot surface a table that was never created. Reloading
  -- is still done at the end of this file, because creating the table does
  -- require the cache to pick it up.
  --
  -- Contents are identical to 005 and fully idempotent, so running it is safe
  -- whether or not 005 was partially applied.

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

  -- Without these grants PostgREST hides the table even after it exists.
  grant select, insert, update, delete on session_notes to authenticated;
  grant all privileges on session_notes to service_role;

  -- Make the new table visible to the API immediately instead of waiting for
  -- PostgREST to notice it on its own.
  notify pgrst, 'reload schema';
