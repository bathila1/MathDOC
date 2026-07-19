import { z } from "zod";
import { normalizePhone } from "./phone";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  STUDENT_CATEGORIES,
} from "./constants";

/** Reusable Sri Lankan phone field — normalizes to +947XXXXXXXX. */
export const phoneField = z
  .string()
  .trim()
  .min(1, "Please enter your phone number.")
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Please enter a valid Sri Lankan mobile number (e.g. 0771234567).",
      });
      return z.NEVER;
    }
    return normalized;
  });

// ---------- Auth ----------

export const otpRequestSchema = z.object({
  phone: phoneField,
});

export const otpVerifySchema = z.object({
  phone: phoneField,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "The code is the 6-digit number we sent by SMS."),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

// ---------- Student profile / registration ----------

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(100, "Name is too long (max 100 characters)."),
  school: z
    .string()
    .trim()
    .min(2, "Please enter your school.")
    .max(120, "School name is too long."),
  grade: z
    .string()
    .trim()
    .min(1, "Please select your grade / year.")
    .max(30, "Grade is too long."),
  guardian_name: z
    .string()
    .trim()
    .min(2, "Please enter a parent or guardian's name.")
    .max(100, "Guardian name is too long."),
  guardian_phone: phoneField,
  address: z
    .string()
    .trim()
    .min(5, "Please enter your address.")
    .max(300, "Address is too long."),
});

export const categorySchema = z.object({
  student_id: z.string().uuid(),
  category: z.enum(STUDENT_CATEGORIES, {
    message: "Please pick a category.",
  }),
});

// ---------- MCQ ----------

export const mcqQuestionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, "Please write the question.")
    .max(1000, "Question is too long."),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Answer options can't be empty.")
        .max(300, "Option is too long.")
    )
    .min(2, "Add at least 2 answer options.")
    .max(6, "Maximum 6 answer options."),
  correct_index: z.number().int().min(0),
  is_active: z.boolean().default(true),
}).refine((q) => q.correct_index < q.options.length, {
  message: "Pick which option is the correct answer.",
  path: ["correct_index"],
});

export const mcqSubmitSchema = z.object({
  answers: z.record(
    z.string().uuid(),
    z.number().int().min(0).max(5)
  ),
});

// ---------- Availability & booking ----------

export const slotSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date."),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Please pick a start time."),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "Please pick an end time."),
    mode: z.enum(["physical", "online", "either"], {
      message: "Please choose physical, online, or either.",
    }),
  })
  .refine((s) => s.start_time < s.end_time, {
    message: "End time must be after the start time.",
    path: ["end_time"],
  });

export const bookingSchema = z.object({
  slot_id: z.string().uuid("Please choose a time slot."),
  mode: z.enum(["physical", "online"], {
    message: "Please choose physical or online.",
  }),
  follow_up_task_id: z.string().uuid().optional(),
});

export const meetingLinkSchema = z.object({
  appointment_id: z.string().uuid(),
  meeting_link: z
    .string()
    .trim()
    .url("Please paste a valid link (e.g. https://meet.google.com/...).")
    .max(500, "Link is too long.")
    .or(z.literal("")),
});

export const diagnosisSchema = z.object({
  appointment_id: z.string().uuid(),
  diagnosis_notes: z.string().trim().max(5000, "Notes are too long.").optional(),
});

// ---------- Tasks ----------

export const taskSchema = z.object({
  appointment_id: z.string().uuid(),
  type: z.enum(["task", "meet_sir"]),
  title: z
    .string()
    .trim()
    .min(2, "Please give the task a title.")
    .max(150, "Title is too long."),
  description: z
    .string()
    .trim()
    .min(2, "Please describe what the student should do.")
    .max(5000, "Description is too long."),
  attachment_key: z.string().max(500).optional().nullable(),
});

export const taskEditSchema = taskSchema
  .omit({ appointment_id: true })
  .extend({ task_id: z.string().uuid() });

export const proofSubmitSchema = z.object({
  task_id: z.string().uuid(),
  file_keys: z
    .array(z.string().min(1).max(500))
    .min(1, "Please attach at least one photo or PDF of your work.")
    .max(10, "Maximum 10 files per proof."),
  student_note: z.string().trim().max(1000, "Note is too long.").optional(),
});

export const proofReviewSchema = z.object({
  proof_id: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  teacher_note: z.string().trim().max(1000, "Note is too long.").optional(),
});

// ---------- Uploads ----------

export const presignSchema = z.object({
  file_name: z.string().trim().min(1).max(200),
  content_type: z.enum(ALLOWED_UPLOAD_TYPES, {
    message: "Only PDF, JPG, PNG or WebP files are allowed.",
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, "The file is too large — maximum size is 10 MB."),
  purpose: z.enum(["task_attachment", "proof"]),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type McqQuestionInput = z.infer<typeof mcqQuestionSchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
