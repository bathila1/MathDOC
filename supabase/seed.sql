-- MathDoc sample data. Run after the migrations (optional but recommended for dev).

insert into settings (key, value) values
  ('appointment_price', '2000'),
  ('location', 'No. 12, Temple Road, Kandy')  -- shown in SMS for physical meetings
on conflict (key) do update set value = excluded.value;

insert into mcq_questions (text, options, correct_index, sort_order) values
  ('What is the value of 3x when x = 4?',
   '["7", "12", "34", "1"]', 1, 1),
  ('The angle in a semicircle is always…',
   '["45°", "60°", "90°", "180°"]', 2, 2),
  ('Solve: 2x + 6 = 14',
   '["x = 4", "x = 10", "x = 7", "x = 2"]', 0, 3),
  ('The circumference of a circle with radius r is…',
   '["πr²", "2πr", "πd²", "r²/2"]', 1, 4),
  ('If a triangle has angles 50° and 60°, the third angle is…',
   '["70°", "80°", "90°", "60°"]', 0, 5);

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
