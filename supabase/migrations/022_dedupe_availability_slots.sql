-- Merge duplicate availability slots and stop new ones being created.
--
-- WHY: createSlot() never checked for collisions, so saving the same time twice
-- inserted a second identical row. On the calendar both cards were drawn at the
-- same position, one hiding the other — the "overlapping" the teacher reported.
--
-- The dangerous case was a FREE duplicate sitting on top of a BOOKED slot: the
-- time looked bookable to a second student even though Sir was already engaged.
--
-- MERGE, NOT DELETE. An earlier version of this file simply deleted the extra
-- rows and failed with:
--     23503: update or delete on table "availability_slots" violates foreign
--     key constraint "appointments_slot_id_fkey"
-- because the duplicates carry appointment history — cancelled bookings, each
-- with an invoice. Deleting them would have destroyed those records (or been
-- blocked, as it was). Since the duplicates describe the SAME time, moving that
-- history onto the surviving row loses nothing: a student's cancelled 4–5 PM
-- booking is still a cancelled 4–5 PM booking afterwards.
--
-- The application now rejects overlaps before insert. This file cleans up what
-- was created before that check existed.

-- The surviving row for each duplicated time:
--   1. a booked slot always wins (it holds the live appointment)
--   2. otherwise the oldest
--
-- The CTE is repeated rather than shared via a temp view, so each statement
-- stands alone no matter how the SQL editor batches them. It orders only by
-- columns these statements do NOT modify (status, created_at, id), so both
-- passes independently pick the same winner.

-- 1. Move appointment history onto the surviving slot.
with dupes as (
  select
    s.id,
    first_value(s.id) over (
      partition by s.starts_at, s.ends_at
      order by (s.status = 'booked') desc, s.created_at, s.id
    ) as keeper
  from availability_slots s
)
update appointments a
set slot_id = d.keeper
from dupes d
where a.slot_id = d.id
  and d.id <> d.keeper;

-- 2. The duplicates are now unreferenced and can go.
with dupes as (
  select
    s.id,
    first_value(s.id) over (
      partition by s.starts_at, s.ends_at
      order by (s.status = 'booked') desc, s.created_at, s.id
    ) as keeper
  from availability_slots s
)
delete from availability_slots s
using dupes d
where s.id = d.id
  and d.id <> d.keeper;

-- ---------- prevent it happening again ----------
-- A unique index catches the double-click/duplicate case even if some future
-- code path forgets to check. Partial overlaps (10:00-11:30 vs 11:00-12:00)
-- are still handled in application code, since expressing that as a constraint
-- needs the btree_gist extension and an exclusion constraint — deliberately
-- avoided here to keep this migration safe to run on a live database.
create unique index if not exists availability_slots_unique_time
  on availability_slots (starts_at, ends_at);

notify pgrst, 'reload schema';
