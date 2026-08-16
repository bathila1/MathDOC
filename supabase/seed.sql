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
  ('location', 'No. 12, Temple Road, Kandy')  -- shown in SMS for physical meetings
on conflict (key) do update set value = excluded.value;

-- A starter survey. Sir edits these under Admin -> Survey questions.
-- The 'number' question is the one worth tracking: study hours are compared
-- against the previous submission on the student's page.
-- NOTE: kept deliberately ASCII-only. Special characters get mangled when this
-- file is copied through tools that assume a non-UTF-8 encoding.
insert into survey_questions (kind, text, options, unit, is_required, sort_order) values
  ('number', 'How many hours a week are you studying maths at the moment?',
   '{}', 'hours / week', true, 1),
  ('choice', 'When do you usually study?',
   '{"Early morning","Afternoon","Evening","Late night"}', null, true, 2),
  ('text',   'Which topic are you most interested in right now?',
   '{}', null, true, 3),
  ('text',   'Which topic is giving you the most trouble?',
   '{}', null, true, 4);

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
