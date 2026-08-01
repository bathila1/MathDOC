import { z } from "zod";
import { normalizePhone } from "./phone";
import { STUDENT_CATEGORIES, UPLOAD_RULES } from "./constants";

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
  // Accepts a plain username ("sir") or a full email address; usernames are
  // stored internally as <username>@mathdoc.local in Supabase Auth.
  email: z
    .string()
    .trim()
    .min(1, "Please enter your username or email.")
    .transform((v) => (v.includes("@") ? v : `${v.toLowerCase()}@mathdoc.local`))
    .pipe(z.string().email("Please enter a valid username or email.")),
  password: z.string().min(1, "Please enter your password."),
});

// ---------- Student profile / registration ----------

// TESTING MODE: nothing is compulsory for now — every field may be left
// empty. Re-tighten these before going live (see README roadmap).
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .optional()
    .transform((v) => (v ? v : null));

export const profileSchema = z.object({
  full_name: optionalText(100, "Name"),
  school: optionalText(120, "School name"),
  grade: optionalText(30, "Grade"),
  guardian_name: optionalText(100, "Guardian name"),
  guardian_phone: optionalText(30, "Guardian phone"),
  address: optionalText(300, "Address"),
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

export const sessionNoteSchema = z.object({
  appointment_id: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Please write the note first.")
    .max(1000, "Note is too long (max 1000 characters)."),
});

export const studentNoteSchema = z.object({
  student_id: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Please write the note first.")
    .max(2000, "Note is too long (max 2000 characters)."),
});

export const slotUpdateSchema = z.object({
  slot_id: z.string().uuid(),
  mode: z.enum(["physical", "online", "either"], {
    message: "Please choose physical, online, or either.",
  }),
});

export const diagnosisSchema = z.object({
  appointment_id: z.string().uuid(),
  diagnosis_notes: z.string().trim().max(5000, "Notes are too long.").optional(),
});

// ---------- Tasks ----------

// Base object shared by add + edit. Cross-field rules (due date must parse)
// are applied in the server action so this stays a plain object that
// .omit()/.extend() still work on. Any combination of media may be attached.
const taskBase = z.object({
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
    .max(5000, "Description is too long.")
    .optional()
    .transform((v) => v ?? ""),
  attachment_key: z.string().max(500).optional().nullable(),
  is_priority: z.boolean().optional().default(false),
  timer_minutes: z
    .number()
    .int()
    .min(1, "Timer must be at least 1 minute.")
    .max(600, "Timer is too long (max 10 hours).")
    .optional()
    .nullable(),
  due_at: z.string().trim().max(40).optional().nullable(), // datetime-local / ISO
  youtube_url: z.string().trim().max(500).optional().nullable(),
  facebook_url: z.string().trim().max(500).optional().nullable(),
  video_key: z.string().max(500).optional().nullable(),
  voice_key: z.string().max(500).optional().nullable(),
  question_image_key: z.string().max(500).optional().nullable(),
  // Private note only the teacher sees (stored in task_sir_notes).
  sir_note: z.string().trim().max(2000, "Note is too long.").optional().nullable(),
});

export const taskSchema = taskBase;

export const taskEditSchema = taskBase
  .omit({ appointment_id: true })
  .extend({ task_id: z.string().uuid() });

export const defaultTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Please give the template a title.")
    .max(150, "Title is too long."),
  description: z
    .string()
    .trim()
    .max(5000, "Description is too long.")
    .optional()
    .transform((v) => v ?? ""),
  type: z.enum(["task", "meet_sir"]),
  is_priority: z.boolean().optional().default(false),
  timer_minutes: z.number().int().min(1).max(600).optional().nullable(),
});

export const proofSubmitSchema = z.object({
  task_id: z.string().uuid(),
  // TESTING MODE: files optional for now (min 1 again before going live)
  file_keys: z
    .array(z.string().min(1).max(500))
    .max(10, "Maximum 10 files per proof."),
  student_note: z.string().trim().max(1000, "Note is too long.").optional(),
  time_spent_seconds: z.number().int().min(0).max(24 * 3600).optional().nullable(),
});

export const proofReviewSchema = z.object({
  proof_id: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  teacher_note: z.string().trim().max(1000, "Note is too long.").optional(),
});

export const taskMessageSchema = z
  .object({
    task_id: z.string().uuid(),
    body: z
      .string()
      .trim()
      .max(2000, "Message is too long.")
      .optional()
      .transform((v) => v ?? ""),
    image_key: z.string().max(500).optional().nullable(),
  })
  .refine((m) => m.body.length > 0 || Boolean(m.image_key), {
    message: "Type a message or attach an image.",
    path: ["body"],
  });

// ---------- Uploads ----------

export const presignSchema = z
  .object({
    file_name: z.string().trim().min(1).max(200),
    content_type: z.string().trim().min(1).max(150),
    size: z.number().int().positive(),
    purpose: z.enum([
      "task_attachment",
      "proof",
      "question_image",
      "task_media",
      "voice_note",
      "chat_image",
    ]),
  })
  .superRefine((v, ctx) => {
    const rule = UPLOAD_RULES[v.purpose];
    if (!(rule.types as readonly string[]).includes(v.content_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["content_type"],
        message: "That file type isn't allowed here.",
      });
    }
    if (v.size > rule.maxBytes) {
      ctx.addIssue({
        code: "custom",
        path: ["size"],
        message: `That file is too large (max ${Math.round(
          rule.maxBytes / (1024 * 1024)
        )} MB).`,
      });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;
export type McqQuestionInput = z.infer<typeof mcqQuestionSchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
