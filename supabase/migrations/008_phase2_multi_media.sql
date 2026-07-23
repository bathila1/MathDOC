-- MathDOC Phase 2 — Slice 2b: allow several media on one task (YouTube + Facebook
-- + uploaded video + voice note, in any combination). Run after 007.

alter table tasks add column if not exists youtube_url text;
alter table tasks add column if not exists facebook_url text;
alter table tasks add column if not exists video_key text;   -- R2 key for an uploaded video
alter table tasks add column if not exists voice_key text;   -- R2 key for a voice note

-- Carry over anything stored under the old single-media columns (007).
update tasks set youtube_url  = media_url where media_type = 'youtube' and media_url is not null and youtube_url is null;
update tasks set facebook_url = media_url where media_type = 'facebook' and media_url is not null and facebook_url is null;
update tasks set video_key    = media_key where media_type = 'video'    and media_key is not null and video_key is null;
update tasks set voice_key    = media_key where media_type = 'voice'    and media_key is not null and voice_key is null;
