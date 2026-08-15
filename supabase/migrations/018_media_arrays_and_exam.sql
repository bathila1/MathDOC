-- MathDOC — multi-media tasks + richer placement test. Run after 017.
--
-- TWO changes in one file so there is a single migration to apply:
--   A) tasks/default_tasks can hold MANY of each media type, not one
--   B) placement-exam questions can carry an image and accept a typed answer

-- ─────────────────────────────────────────────────────────────
-- A) Multi-media on tasks
--
-- The singular columns stay in place and are BACKFILLED into the new arrays,
-- so nothing breaks if this is applied while the old build is still serving.
-- They are no longer read by the app and can be dropped once you're happy
-- (see the commented-out block at the bottom).
-- ─────────────────────────────────────────────────────────────

alter table tasks
  add column if not exists youtube_urls        text[] not null default '{}',
  add column if not exists facebook_urls       text[] not null default '{}',
  add column if not exists video_keys          text[] not null default '{}',
  add column if not exists voice_keys          text[] not null default '{}',
  add column if not exists question_image_keys text[] not null default '{}',
  add column if not exists attachment_keys     text[] not null default '{}';

-- Backfill: one-element arrays from whatever each task already had.
update tasks set
  youtube_urls = case when coalesce(youtube_url, '') <> ''
                   then array[youtube_url] else youtube_urls end,
  facebook_urls = case when coalesce(facebook_url, '') <> ''
                   then array[facebook_url] else facebook_urls end,
  video_keys = case when coalesce(video_key, '') <> ''
                   then array[video_key] else video_keys end,
  voice_keys = case when coalesce(voice_key, '') <> ''
                   then array[voice_key] else voice_keys end,
  question_image_keys = case when coalesce(question_image_key, '') <> ''
                   then array[question_image_key] else question_image_keys end,
  attachment_keys = case when coalesce(attachment_key, '') <> ''
                   then array[attachment_key] else attachment_keys end
where youtube_urls = '{}'
  and facebook_urls = '{}'
  and video_keys = '{}'
  and voice_keys = '{}'
  and question_image_keys = '{}'
  and attachment_keys = '{}';

-- Same media options on reusable templates, so "Add default task" can offer
-- the identical form to the appointment page's task form.
alter table default_tasks
  add column if not exists youtube_urls        text[] not null default '{}',
  add column if not exists facebook_urls       text[] not null default '{}',
  add column if not exists video_keys          text[] not null default '{}',
  add column if not exists voice_keys          text[] not null default '{}',
  add column if not exists question_image_keys text[] not null default '{}',
  add column if not exists attachment_keys     text[] not null default '{}';

-- ─────────────────────────────────────────────────────────────
-- B) Placement exam: image questions + typed answers
-- ─────────────────────────────────────────────────────────────

-- 'mcq'  = multiple choice, auto-graded against correct_index
-- 'text' = the student types an answer; Sir reads it (not auto-graded)
alter table mcq_questions
  add column if not exists kind text not null default 'mcq',
  add column if not exists image_key text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'mcq_questions_kind_check'
  ) then
    alter table mcq_questions
      add constraint mcq_questions_kind_check check (kind in ('mcq', 'text'));
  end if;
end $$;

-- A typed-answer question has no correct option, so this must be nullable.
alter table mcq_questions alter column correct_index drop not null;

comment on column mcq_questions.kind is
  '''mcq'' = auto-graded choice; ''text'' = free-text answer reviewed by Sir.';
comment on column mcq_questions.image_key is
  'Optional R2 object key for a picture shown with the question.';

-- mcq_attempts.answers is already jsonb: { question_id: number | string }.
-- Numbers are chosen option indexes, strings are typed answers. No change needed.

-- ─────────────────────────────────────────────────────────────
-- Optional cleanup — run only AFTER confirming the new build works:
--
-- alter table tasks
--   drop column youtube_url, drop column facebook_url, drop column video_key,
--   drop column voice_key, drop column question_image_key,
--   drop column attachment_key;
-- ─────────────────────────────────────────────────────────────
