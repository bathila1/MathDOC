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
