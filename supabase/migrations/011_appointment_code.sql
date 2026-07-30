-- MathDOC — human-friendly appointment code for admin search. Run after 010.
--
-- A short, stable code (first 6 hex chars of the id, e.g. "3F9A2C") generated
-- automatically for every existing and future appointment. Lets the teacher
-- look up any appointment by its code. Purely derived — no backfill needed and
-- nothing to change in book_appointment().

alter table appointments
  add column if not exists code text
  generated always as (upper(substr(replace(id::text, '-', ''), 1, 6))) stored;

create index if not exists appointments_code_idx on appointments (code);
