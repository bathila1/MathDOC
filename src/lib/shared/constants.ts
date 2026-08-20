export const APP_NAME = "MathDOC";

/**
 * Shown on /login when the SMS gateway refuses our credentials. Deliberately
 * names the cause: "check the number" sends a student chasing a fault that is
 * ours, and only an operator can fix this one (see docs/sms-otp-setup.md).
 * The Send-SMS hook returns this string and Supabase passes it back through
 * signInWithOtp, so both ends must use this constant, not a copy.
 */
export const SMS_GATEWAY_AUTH_ERROR = "Hutch SMS Gateway Authentication Error.";
export const TEACHER_NAME = "Sir"; // display name used across the UI

// Appointment price in LKR (payment gateway comes later; invoice uses this)
export const APPOINTMENT_PRICE_LKR = 2000;

// Follow-up ("Meet with Sir" checkpoint) appointments are free
export const FOLLOW_UP_PRICE_LKR = 0;

// Upload limits & per-purpose rules
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — images / PDFs / proof
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB — uploaded task videos
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB — voice notes
export const MAX_ANY_UPLOAD_BYTES = MAX_VIDEO_BYTES; // largest allowed anywhere

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOC_TYPES = ["application/pdf", ...IMAGE_TYPES] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
] as const;

// Kept for older imports (task attachments / proofs accept docs + images).
export const ALLOWED_UPLOAD_TYPES = DOC_TYPES;

/** What each upload purpose accepts, enforced on the client and at presign. */
export const UPLOAD_RULES = {
  task_attachment: { types: DOC_TYPES, maxBytes: MAX_UPLOAD_BYTES },
  proof: { types: DOC_TYPES, maxBytes: MAX_UPLOAD_BYTES },
  question_image: { types: IMAGE_TYPES, maxBytes: MAX_UPLOAD_BYTES },
  task_media: { types: VIDEO_TYPES, maxBytes: MAX_VIDEO_BYTES },
  voice_note: { types: AUDIO_TYPES, maxBytes: MAX_AUDIO_BYTES },
  chat_image: { types: IMAGE_TYPES, maxBytes: MAX_UPLOAD_BYTES },
} as const;

export type UploadPurpose = keyof typeof UPLOAD_RULES;

export const STUDENT_CATEGORIES = [
  "Beginner",
  "Intermediate",
  "Advanced",
] as const;

export type StudentCategory = (typeof STUDENT_CATEGORIES)[number];
