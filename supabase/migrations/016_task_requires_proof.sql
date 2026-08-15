-- MathDOC — "does this task need proof?" flag. Run after 015.
--
-- Some tasks have nothing to upload ("revise today's topic", "read chapter 4").
-- For those, the student should get a simple "Mark as done / Send to Sir"
-- button instead of an upload drop-zone. Sir chooses per task when creating it.
--
-- Defaults to true so every EXISTING task keeps its current behaviour.

alter table tasks
  add column if not exists requires_proof boolean not null default true;

comment on column tasks.requires_proof is
  'When false the student submits with a button and no file upload.';

-- Same option on reusable task templates.
alter table default_tasks
  add column if not exists requires_proof boolean not null default true;
