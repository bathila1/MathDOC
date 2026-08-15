-- MathDOC — images attached to an appointment's diagnosis notes. Run after 016.
--
-- Sir often photographs a student's working during the first session; those
-- photos belong with the written diagnosis. Stored as R2 object keys, served
-- through short-lived presigned URLs like every other upload.

alter table appointments
  add column if not exists diagnosis_image_keys text[] not null default '{}';

comment on column appointments.diagnosis_image_keys is
  'R2 object keys for photos attached to diagnosis_notes.';
