export const APP_NAME = "MathDoc";
export const TEACHER_NAME = "Sir"; // display name used across the UI

// Appointment price in LKR (payment gateway comes later; invoice uses this)
export const APPOINTMENT_PRICE_LKR = 2000;

// Follow-up ("Meet with Sir" checkpoint) appointments are free
export const FOLLOW_UP_PRICE_LKR = 0;

// Upload limits
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const STUDENT_CATEGORIES = [
  "Beginner",
  "Intermediate",
  "Advanced",
] as const;

export type StudentCategory = (typeof STUDENT_CATEGORIES)[number];
