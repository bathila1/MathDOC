-- Replaces the placement test with a pre-booking survey.
--
-- The placement test ran once at registration and produced a score. The survey
-- is different in kind: it is answered again before EVERY booking to track
-- study habits — hours studied per week, favourite topic, time of day they
-- study. The POINT is the change over time: a student who gets interested
-- reports more hours before their next session.
--
-- So responses are kept as history (one row per submission) and never
-- overwritten. Storing only the latest answers would throw away the entire
-- signal this feature exists to capture.
--
-- ⚠️ DESTRUCTIVE: the bottom of this file drops mcq_questions and mcq_attempts
-- and the profiles.mcq_score / mcq_total columns. Every past quiz answer and
-- score is deleted permanently. That is the intent ("ditch the placement test
-- idea completely"), but it cannot be undone — take a snapshot first if you
-- want the old answers kept anywhere.

-- ---------- survey questions (authored by Sir) ----------

create table if not exists survey_questions (
  id          uuid primary key default gen_random_uuid(),
  -- 'text'   = free typing ("which topic interests you most?")
  -- 'choice' = pick one of `options` ("when do you study?")
  -- 'number' = a numeric answer ("hours studied per week") — kept separate from
  --            text so answers are comparable across submissions, which is the
  --            whole point of re-asking them.
  kind        text not null default 'text'
                check (kind in ('text', 'choice', 'number')),
  text        text not null,
  options     text[] not null default '{}',
  -- Shown after a numeric answer, e.g. "hours / week".
  unit        text,
  is_required boolean not null default true,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists survey_questions_order_idx
  on survey_questions (sort_order);

alter table survey_questions enable row level security;

-- Students must be able to read the questions to answer them. Unlike the old
-- mcq_questions there is nothing secret in this table (no correct answers), so
-- a direct read is safe and avoids a service-role round-trip.
drop policy if exists "survey_questions: read active" on survey_questions;
create policy "survey_questions: read active" on survey_questions
  for select using (is_active or is_admin());

drop policy if exists "survey_questions: admin write" on survey_questions;
create policy "survey_questions: admin write" on survey_questions
  for all using (is_admin()) with check (is_admin());

grant select on survey_questions to authenticated;
grant all privileges on survey_questions to service_role;

-- ---------- survey responses (one row per submission) ----------

create table if not exists survey_responses (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles (id) on delete cascade,
  -- { "<question uuid>": "<answer text>" }. Choice answers store the chosen
  -- option's TEXT, not its index: if Sir later reorders or edits the options,
  -- a stored index would silently start pointing at a different answer.
  answers      jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists survey_responses_student_idx
  on survey_responses (student_id, submitted_at desc);

alter table survey_responses enable row level security;

drop policy if exists "survey_responses: own read" on survey_responses;
create policy "survey_responses: own read" on survey_responses
  for select using (student_id = auth.uid() or is_admin());

drop policy if exists "survey_responses: own insert" on survey_responses;
create policy "survey_responses: own insert" on survey_responses
  for insert with check (student_id = auth.uid());

drop policy if exists "survey_responses: admin all" on survey_responses;
create policy "survey_responses: admin all" on survey_responses
  for all using (is_admin()) with check (is_admin());

grant select, insert on survey_responses to authenticated;
grant all privileges on survey_responses to service_role;

-- ---------- a starter set of questions ----------
-- Only when the table is empty, so re-running this file never duplicates them
-- or resurrects questions Sir has deliberately deleted. He can edit, reorder,
-- hide or delete all of these under Admin → Survey questions.

insert into survey_questions (kind, text, options, unit, is_required, sort_order)
select * from (values
  ('number', 'How many hours a week are you studying maths at the moment?',
   '{}'::text[], 'hours / week', true, 1),
  ('choice', 'When do you usually study?',
   '{"Early morning","Afternoon","Evening","Late night"}'::text[], null::text, true, 2),
  ('text',   'Which topic are you most interested in right now?',
   '{}'::text[], null::text, true, 3),
  ('text',   'Which topic is giving you the most trouble?',
   '{}'::text[], null::text, true, 4)
) as seed
where not exists (select 1 from survey_questions);

-- ---------- remove the placement test ----------
-- mcq_attempts first: it has no FK to mcq_questions, but dropping the answers
-- before the questions keeps the intent obvious.

drop table if exists mcq_attempts;
drop table if exists mcq_questions;

alter table profiles drop column if exists mcq_score;
alter table profiles drop column if exists mcq_total;

notify pgrst, 'reload schema';
