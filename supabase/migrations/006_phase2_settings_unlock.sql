-- MathDOC Phase 2 — Slice 1: payments toggle + unlocked tasks.
-- Run after 005_session_notes.sql in the Supabase SQL editor.

-- Payments are OFF for now (the pricing/payment step is hidden until the
-- gateway is added). Toggle this from the admin Settings tab.
insert into settings (key, value)
values ('payments_enabled', 'false')
on conflict (key) do nothing;

-- Nothing is locked anymore: a student can attempt any task in any order.
-- Normalise any existing 'locked' rows so they show as open, and make new
-- tasks default to 'active' (the 'locked' enum value is kept for old data).
update tasks set status = 'active' where status = 'locked';
alter table tasks alter column status set default 'active';
