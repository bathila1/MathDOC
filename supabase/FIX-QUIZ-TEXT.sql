-- Run this ONCE in the Supabase SQL Editor to repair the placement-quiz
-- questions whose special characters were mangled (e.g. "Ï€rÂ²", "â€¦").
-- It replaces the five seeded questions with ASCII-safe wording and keeps
-- everything else (students, tasks, appointments) untouched.

delete from mcq_attempts;
delete from mcq_questions;
update profiles set mcq_score = null, mcq_total = null where role = 'student';

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
