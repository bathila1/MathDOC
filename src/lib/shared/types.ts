// Hand-maintained row types matching supabase/migrations/001_schema.sql

export type Role = "admin" | "student";
export type SlotMode = "physical" | "online" | "either";
export type AppointmentMode = "physical" | "online";
export type AppointmentStatus =
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "cancelled";
export type InvoiceStatus = "unpaid" | "paid" | "bypassed";
export type TaskType = "task" | "meet_sir";
export type TaskStatus = "locked" | "active" | "proof_submitted" | "approved";
export type ProofStatus = "pending" | "accepted" | "rejected";
/** Task media kinds (Phase 2). */
export type MediaType = "youtube" | "facebook" | "video" | "voice";
/** Student self-assessment on a task (Phase 3). */
export type StudentFlag = "hard" | "cant_do";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  school: string | null;
  grade: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  category: string | null;
  profile_completed: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SurveyQuestionKind = "text" | "choice" | "number";

/** A question Sir asks every student before they book a session. */
export interface SurveyQuestion {
  id: string;
  /** 'text' = free typing; 'choice' = one of `options`; 'number' = numeric. */
  kind: SurveyQuestionKind;
  text: string;
  options: string[];
  /** Shown after a numeric answer, e.g. "hours / week". */
  unit: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SurveyResponse {
  id: string;
  student_id: string;
  /** question id → answer text (choice answers store the option's text). */
  answers: Record<string, string>;
  submitted_at: string;
}

export interface AvailabilitySlot {
  id: string;
  starts_at: string;
  ends_at: string;
  mode: SlotMode;
  status: "free" | "booked";
  created_at: string;
}

export interface Appointment {
  id: string;
  student_id: string;
  slot_id: string;
  mode: AppointmentMode;
  status: AppointmentStatus;
  meeting_link: string | null;
  diagnosis_notes: string | null;
  /** R2 object keys for photos attached to the diagnosis (migration 017). */
  diagnosis_image_keys: string[] | null;
  price: number;
  is_follow_up: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  appointment_id: string;
  public_token: string;
  amount: number;
  status: InvoiceStatus;
  issued_at: string;
}

export interface Task {
  id: string;
  appointment_id: string;
  student_id: string;
  sort_order: number;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  follow_up_appointment_id: string | null;
  // Phase 2 additions
  is_priority: boolean;
  /** false => student submits with a button, no upload required. */
  requires_proof: boolean;
  // (see Appointment for diagnosis_image_keys)
  timer_seconds: number | null;
  due_at: string | null;
  // Media — ANY NUMBER of each type may be attached (migration 018).
  // The old singular columns are still in the table but are no longer read.
  youtube_urls: string[];
  facebook_urls: string[];
  video_keys: string[]; // R2 keys for uploaded videos
  voice_keys: string[]; // R2 keys for voice notes
  question_image_keys: string[];
  attachment_keys: string[];
  student_flag: StudentFlag | null;
  created_at: string;
  updated_at: string;
}

/** A reusable task template the teacher can drop onto any student. */
export interface DefaultTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  is_priority: boolean;
  requires_proof: boolean;
  timer_seconds: number | null;
  // Same media options as a real task (migration 018).
  youtube_urls: string[];
  facebook_urls: string[];
  video_keys: string[];
  voice_keys: string[];
  question_image_keys: string[];
  attachment_keys: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProofSubmission {
  id: string;
  task_id: string;
  student_id: string;
  file_keys: string[];
  student_note: string | null;
  status: ProofStatus;
  teacher_note: string | null;
  time_spent_seconds: number | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface SessionNote {
  id: string;
  appointment_id: string;
  student_id: string;
  body: string;
  created_at: string;
}

export interface Certificate {
  id: string;
  student_id: string;
  appointment_id: string;
  public_token: string;
  issued_at: string;
}

/** Private note the teacher keeps about a student (never shown to students). */
export interface StudentTeacherNote {
  id: string;
  student_id: string;
  body: string;
  created_at: string;
}

/** In-app notification for one recipient (bell + side panel). */
export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  sender_id: string;
  sender_role: "student" | "admin";
  body: string;
  image_key: string | null;
  created_at: string;
}
