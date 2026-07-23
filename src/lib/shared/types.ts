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
  mcq_score: number | null;
  mcq_total: number | null;
  profile_completed: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface McqQuestion {
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Question as exposed to students (no correct_index). */
export type McqQuestionPublic = Omit<McqQuestion, "correct_index">;

export interface McqAttempt {
  id: string;
  student_id: string;
  answers: Record<string, number>;
  score: number;
  total: number;
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
  attachment_key: string | null;
  status: TaskStatus;
  follow_up_appointment_id: string | null;
  // Phase 2 additions
  is_priority: boolean;
  timer_seconds: number | null;
  due_at: string | null;
  // Media — any combination may be set on one task.
  youtube_url: string | null;
  facebook_url: string | null;
  video_key: string | null; // R2 key for an uploaded video
  voice_key: string | null; // R2 key for a voice note
  question_image_key: string | null;
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
  timer_seconds: number | null;
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
