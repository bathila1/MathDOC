-- Correct availability slots stored with the wrong timezone offset.
--
-- ⚠️ OPTIONAL AND DESTRUCTIVE-ISH — READ BEFORE RUNNING.
--
-- THE BUG: createSlot() built the timestamp with
--     new Date(`${date}T${start_time}:00`)
-- on the SERVER. That parses a wall-clock string in the runtime's timezone,
-- which on Vercel is UTC — but the teacher was picking Sri Lankan times. Every
-- slot was therefore stored as if 08:00 meant 08:00 UTC, and rendered back to
-- everyone as 13:30 (UTC+5:30). "Add 8am" produced a 1:30 PM slot.
--
-- Fixed in the application: the browser now resolves the instant, because only
-- it knows the teacher's timezone. This file repairs rows created beforehand.
--
-- WHAT IT DOES: shifts FUTURE slots back by 5 hours 30 minutes, so a row stored
-- as 08:00Z becomes 02:30Z — which is 08:00 in Colombo, the time actually
-- intended. Past slots are left alone; rewriting history helps nobody.
--
-- BEFORE RUNNING, CHECK TWO THINGS:
--
-- 1. Only run this ONCE. Running it twice shifts everything 11 hours early.
--    The SELECT below shows what will change — run that first.
--
-- 2. Booked slots move too. Students were told a time by SMS, and that SMS was
--    ALSO generated server-side in UTC, so it quoted the same wall-clock the
--    teacher typed ("8:00 AM"). Shifting therefore makes the calendar agree
--    with what students were already told. If you would rather not touch live
--    bookings, add `and status = 'free'` to the UPDATE and re-confirm the
--    booked ones with the student by hand.

-- ---------- STEP 1: preview (run this alone first) ----------
-- select
--   id,
--   status,
--   starts_at                                   as stored_now,
--   starts_at at time zone 'Asia/Colombo'       as shows_as_now,
--   (starts_at - interval '5 hours 30 minutes') at time zone 'Asia/Colombo'
--                                               as shows_as_after
-- from availability_slots
-- where starts_at > now()
-- order by starts_at;

-- ---------- STEP 2: apply ----------
update availability_slots
set
  starts_at = starts_at - interval '5 hours 30 minutes',
  ends_at   = ends_at   - interval '5 hours 30 minutes'
where starts_at > now();

-- The unique index from migration 022 still holds: every row moves by the same
-- amount, so times that were distinct stay distinct.

notify pgrst, 'reload schema';
