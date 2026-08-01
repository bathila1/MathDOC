-- MathDOC — track whether the teacher has seen a task's chat messages, so the
-- admin task row can show an unread red dot instead of a raw message count.
-- Run after 014.

alter table task_messages
  add column if not exists seen_by_admin boolean not null default false;

-- Treat all existing messages as already seen so the switch starts clean
-- (only genuinely new student messages will raise the dot).
update task_messages set seen_by_admin = true where seen_by_admin = false;

create index if not exists task_messages_unseen_idx
  on task_messages (task_id)
  where seen_by_admin = false;
