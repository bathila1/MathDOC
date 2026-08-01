-- MathDOC — private per-student notes for the teacher. Run after 011.
-- Admin-only: students and the teacher share one Postgres role, so these live in
-- their own table behind is_admin() RLS (never a column on `profiles`, which the
-- student can read). One row per note, timestamped.

create table if not exists student_teacher_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists student_teacher_notes_student_idx
  on student_teacher_notes (student_id, created_at desc);

alter table student_teacher_notes enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'student_teacher_notes'
      and policyname = 'student_teacher_notes: admin all'
  ) then
    create policy "student_teacher_notes: admin all" on student_teacher_notes
      for all using (is_admin()) with check (is_admin());
  end if;
end $$;
grant select, insert, update, delete on student_teacher_notes to authenticated;
grant all privileges on student_teacher_notes to service_role;
