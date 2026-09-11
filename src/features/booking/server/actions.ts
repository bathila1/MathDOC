"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getAuth, requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { sendSms } from "@/lib/server/sms";
import {
  buildBookingSms,
  adminCancelledSms,
  studentCancelledSms,
} from "./sms";
import { notify, notifyAdmins } from "@/features/notifications/server/notify";
import { allKeysBelongTo } from "@/lib/server/keys";
import { formatSchool as format } from "@/lib/shared/time";
import {
  bookingSchema,
  slotBulkSchema,
  slotSchema,
  slotUpdateSchema,
  meetingLinkSchema,
  diagnosisSchema,
  sessionNoteSchema,
} from "@/lib/shared/schemas";
import { recalcTaskStatuses } from "@/features/tasks/server/logic";
import { getPaymentsEnabled } from "@/lib/server/settings";
import { getActiveBooking } from "./queries";
import { hasAnsweredSurvey } from "@/features/survey/server/queries";
import { z } from "zod";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { revalidatePath } from "next/cache";
import type { Appointment, AvailabilitySlot, Invoice } from "@/lib/shared/types";

// ---------------- Admin: availability ----------------

export async function createSlot(input: unknown): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { mode } = parsed.data;

  // Already absolute instants — the browser resolved them in the teacher's
  // timezone. Parsing a wall-clock string here would use the server's zone
  // (UTC on Vercel) and shift every slot by the offset.
  const starts_at = new Date(parsed.data.starts_at);
  const ends_at = new Date(parsed.data.ends_at);
  if (starts_at <= new Date()) {
    return fail("Please pick a time in the future.", {
      starts_at: "Please pick a time in the future.",
    });
  }

  const supabase = await createSupabaseServer();

  // Reject anything that collides with an existing slot. Without this, saving
  // the same time twice (a double click, or re-adding a time already there)
  // silently created a duplicate: two cards stacked on the calendar, and — when
  // one of them was already booked — a "free" copy a second student could book
  // for a time Sir was no longer available.
  //
  // Overlap is `existing.start < new.end AND existing.end > new.start`;
  // touching edges (10:00–11:00 then 11:00–12:00) are NOT an overlap.
  const { data: clashes } = await supabase
    .from("availability_slots")
    .select("starts_at, ends_at, status")
    .lt("starts_at", ends_at.toISOString())
    .gt("ends_at", starts_at.toISOString())
    .limit(1);

  const clash = clashes?.[0] as
    | { starts_at: string; ends_at: string; status: string }
    | undefined;
  if (clash) {
    // Deliberately no formatted time here: date-fns on the server formats in
    // the SERVER's timezone, which would print a time the teacher never chose.
    // The calendar already shows the conflicting slot.
    return fail(
      clash.status === "booked"
        ? "That time overlaps a session that's already booked."
        : "That time overlaps a slot already on your calendar. Remove it first, or pick another time."
    );
  }

  const { error } = await supabase.from("availability_slots").insert({
    starts_at: starts_at.toISOString(),
    ends_at: ends_at.toISOString(),
    mode,
  });
  if (error) return fail("Couldn't add the slot. Please try again.");

  revalidatePath("/admin/availability");
  return ok(undefined);
}

/**
 * Add many slots in one go ("every Mon & Wed, 4–5pm, for 6 weeks").
 *
 * Times that clash with something already on the calendar are SKIPPED rather
 * than failing the whole batch — re-running a weekly pattern should fill in the
 * gaps, not refuse because one week is already there. The result reports how
 * many of each so the teacher knows what happened.
 */
export async function createSlotsBulk(
  input: unknown
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = slotBulkSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { slots, mode } = parsed.data;

  const now = Date.now();
  const future = slots.filter((s) => Date.parse(s.starts_at) > now);
  if (future.length === 0) {
    return fail("All of those times are in the past. Pick a later date range.");
  }

  const windowStart = new Date(
    Math.min(...future.map((s) => Date.parse(s.starts_at)))
  ).toISOString();
  const windowEnd = new Date(
    Math.max(...future.map((s) => Date.parse(s.ends_at)))
  ).toISOString();

  const supabase = await createSupabaseServer();

  // One query for the whole window instead of a clash check per slot.
  const { data: existingRows } = await supabase
    .from("availability_slots")
    .select("starts_at, ends_at")
    .lt("starts_at", windowEnd)
    .gt("ends_at", windowStart);

  const taken = ((existingRows ?? []) as { starts_at: string; ends_at: string }[])
    .map((r) => [Date.parse(r.starts_at), Date.parse(r.ends_at)] as const);

  const toInsert: { starts_at: string; ends_at: string; mode: string }[] = [];
  for (const s of future) {
    const from = Date.parse(s.starts_at);
    const to = Date.parse(s.ends_at);
    // Compare against what's stored AND what we've already accepted in this
    // batch, so a pattern can't collide with itself.
    const clashes = taken.some(([a, b]) => a < to && from < b);
    if (clashes) continue;
    taken.push([from, to]);
    toInsert.push({
      starts_at: new Date(from).toISOString(),
      ends_at: new Date(to).toISOString(),
      mode,
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("availability_slots")
      .insert(toInsert);
    if (error) {
      console.error("createSlotsBulk failed:", error.code, error.message);
      return fail("Couldn't add those times. Please try again.");
    }
  }

  revalidatePath("/admin/availability");
  return ok({
    created: toInsert.length,
    skipped: slots.length - toInsert.length,
  });
}

export async function deleteSlot(slotId: string): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(slotId);
  if (!id.success) return fail("Unknown slot.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("availability_slots")
    .delete()
    .eq("id", id.data)
    .eq("status", "free"); // booked slots can't be removed

  if (error) {
    // 23503 = the slot is still referenced by an appointment. A *free* slot can
    // still have one: a student booked it and later cancelled, which releases
    // the slot but keeps the cancelled booking (and its invoice) as history.
    // The generic "couldn't delete" left the teacher clicking with no idea why.
    if (error.code === "23503") {
      return fail(
        "This time can't be removed because a past booking still refers to it. " +
          "Cancelled bookings are kept as a record."
      );
    }
    console.error("deleteSlot failed:", error.code, error.message);
    return fail("Couldn't delete the slot.");
  }

  revalidatePath("/admin/availability");
  return ok(undefined);
}

// ---------------- Student: booking ----------------

/**
 * Book a slot via the book_appointment() SQL function (atomic, race-safe).
 * Regular bookings go to the payment step; follow-ups confirm immediately.
 */
export async function bookSlot(
  input: unknown
): Promise<ActionResult<{ appointmentId: string; needsPayment: boolean }>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");
  if (auth.profile.role !== "student") return fail("Only students can book.");

  const rl = await rateLimit("booking", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { slot_id, mode, follow_up_task_id } = parsed.data;

  // One live booking per student — they must cancel before booking again.
  const existing = await getActiveBooking(auth.user.id);
  if (existing) {
    return fail(
      "You already have a session booked. Please cancel it before booking another one."
    );
  }

  // The survey dialog on /student/book is a UI gate only — this action is
  // reachable directly, so the requirement is enforced here too. We check that
  // a response EXISTS rather than that one was filed since the last session:
  // the dialog always inserts a fresh row, so the stricter rule would only ever
  // catch someone bypassing the UI, at the cost of locking out real students in
  // edge cases (questions added mid-flow, a retried submit).
  if (!(await hasAnsweredSurvey(auth.user.id))) {
    return fail("Please answer the survey questions before booking.");
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_slot_id: slot_id,
    p_mode: mode,
    p_follow_up_task_id: follow_up_task_id ?? null,
  });

  if (error) {
    const friendly: Record<string, string> = {
      SLOT_TAKEN: "Sorry, that time was just booked by someone else. Please pick another slot.",
      SLOT_NOT_FOUND: "That time slot no longer exists. Please pick another one.",
      SLOT_IN_PAST: "That time has already passed. Please pick another slot.",
      MODE_NOT_AVAILABLE: "That slot isn't available for the selected meeting type.",
      TASK_NOT_FOUND: "We couldn't find that checkpoint task.",
    };
    const code = Object.keys(friendly).find((k) => error.message.includes(k));
    return fail(code ? friendly[code] : "Booking failed. Please try again.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  const appointmentId: string = row.appointment_id;
  const isFollowUp = Boolean(follow_up_task_id);

  if (isFollowUp) {
    // Free checkpoint meeting — confirmed immediately; send the SMS now.
    await sendBookingSms(appointmentId);
    revalidatePath("/student");
    return ok({ appointmentId, needsPayment: false });
  }

  // While payments are turned off, skip the pricing/payment step: confirm the
  // booking straight away and mark the invoice as bypassed.
  if (!(await getPaymentsEnabled())) {
    const admin = createSupabaseAdmin();
    await admin
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", appointmentId);
    await admin
      .from("invoices")
      .update({ status: "bypassed" })
      .eq("appointment_id", appointmentId);
    await sendBookingSms(appointmentId);
    revalidatePath("/student");
    return ok({ appointmentId, needsPayment: false });
  }

  return ok({ appointmentId, needsPayment: true });
}

/**
 * TEMPORARY until the payment gateway is added: marks the invoice as bypassed,
 * confirms the appointment, and sends the booking SMS with the invoice link.
 */
export async function bypassPayment(
  appointmentId: string
): Promise<ActionResult<{ invoiceToken: string | null }>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");

  const rl = await rateLimit("booking", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(appointmentId);
  if (!id.success) return fail("Unknown appointment.");

  const admin = createSupabaseAdmin();
  const { data: appt } = await admin
    .from("appointments")
    .select("*")
    .eq("id", id.data)
    .eq("student_id", auth.user.id) // ownership check
    .maybeSingle();
  if (!appt) return fail("We couldn't find that booking.");
  if ((appt as Appointment).status !== "pending_payment") {
    return fail("This booking is already confirmed.");
  }

  await admin
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", id.data);
  await admin
    .from("invoices")
    .update({ status: "bypassed" })
    .eq("appointment_id", id.data);

  const token = await sendBookingSms(id.data);
  revalidatePath("/student");
  return ok({ invoiceToken: token });
}

/**
 * Announce a confirmed booking: SMS the student and notify Sir. Called on
 * every path that confirms an appointment, so neither side can be missed.
 */
async function sendBookingSms(appointmentId: string): Promise<string | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("appointments")
    .select("*, availability_slots(*), invoices(*), profiles(phone, full_name)")
    .eq("id", appointmentId)
    .single();
  if (!data) return null;

  const appt = data as Appointment & {
    availability_slots: AvailabilitySlot;
    invoices: Invoice[] | Invoice | null;
    profiles: { phone: string | null; full_name: string | null };
  };
  const invoice = Array.isArray(appt.invoices)
    ? appt.invoices[0]
    : appt.invoices;
  const token = invoice?.public_token ?? null;

  const phone = appt.profiles?.phone;
  if (phone) {
    const message = await buildBookingSms(appt, appt.availability_slots, token);
    // Best-effort: a failed SMS must not undo a booking the student already
    // made, but it must be visible in the logs rather than silently swallowed.
    const res = await sendSms(phone, message, "MathDOC Booking");
    if (!res.sent) {
      console.error(`Booking SMS failed for appointment ${appointmentId}: ${res.error}`);
    }
  }

  const when = format(
    new Date(appt.availability_slots.starts_at),
    "EEE d MMM 'at' h:mm a"
  );
  await notifyAdmins({
    type: "booking",
    title: appt.is_follow_up ? "New follow-up booked" : "New session booked",
    body: `${appt.profiles?.full_name ?? "A student"} · ${when}`,
    link: `/admin/appointments/${appointmentId}`,
  });

  return token;
}

/**
 * Student cancels their own booking. Frees the slot so it can be booked
 * again, and unlinks any "Meet with Sir" checkpoint it was made for.
 * Uses the service role because students have no UPDATE policy on
 * appointments — ownership is checked explicitly first.
 */
export async function cancelMyBooking(
  appointmentId: string
): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");
  if (auth.profile.role !== "student") return fail("Only students can do that.");

  const rl = await rateLimit("booking", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(appointmentId);
  if (!id.success) return fail("Unknown booking.");

  const admin = createSupabaseAdmin();
  const { data: appt } = await admin
    .from("appointments")
    .select(
      "id, slot_id, status, student_id, is_follow_up, availability_slots(*), profiles(phone, full_name)"
    )
    .eq("id", id.data)
    .eq("student_id", auth.user.id) // ownership check
    .maybeSingle();
  if (!appt) return fail("We couldn't find that booking.");

  const row = appt as unknown as {
    id: string;
    slot_id: string;
    status: string;
    is_follow_up: boolean;
    availability_slots: AvailabilitySlot | null;
    profiles: { phone: string | null; full_name: string | null } | null;
  };
  if (row.status === "cancelled") return fail("This booking is already cancelled.");
  if (row.status === "completed") {
    return fail("This session is already finished, so it can't be cancelled.");
  }
  if (
    row.availability_slots &&
    new Date(row.availability_slots.ends_at).getTime() <= Date.now()
  ) {
    return fail("This session has already passed.");
  }

  await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id.data);
  await admin
    .from("availability_slots")
    .update({ status: "free" })
    .eq("id", row.slot_id);

  // A checkpoint meeting can be rebooked afterwards.
  await admin
    .from("tasks")
    .update({ follow_up_appointment_id: null })
    .eq("follow_up_appointment_id", id.data);

  // Confirm to the student by SMS, and tell Sir the slot is free again.
  if (row.availability_slots) {
    const slot = row.availability_slots;
    if (row.profiles?.phone) {
      const res = await sendSms(
        row.profiles.phone,
        studentCancelledSms(slot, row.is_follow_up),
        "MathDOC Booking"
      );
      if (!res.sent) {
        console.error(`Cancellation SMS failed for ${id.data}: ${res.error}`);
      }
    }
    await notifyAdmins({
      type: "booking_cancelled",
      title: "Session cancelled",
      body: `${row.profiles?.full_name ?? "A student"} cancelled ${format(
        new Date(slot.starts_at),
        "EEE d MMM 'at' h:mm a"
      )}`,
      link: "/admin/appointments",
    });
  }

  revalidatePath("/student");
  revalidatePath("/student/sessions");
  revalidatePath("/student/book");
  revalidatePath("/student/profile");
  revalidatePath("/admin/appointments");
  return ok(undefined);
}

// ---------------- Admin: appointment management ----------------

export async function saveMeetingLink(input: unknown): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = meetingLinkSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("appointments")
    .update({ meeting_link: parsed.data.meeting_link || null })
    .eq("id", parsed.data.appointment_id);
  if (error) return fail("Couldn't save the link.");

  revalidatePath(`/admin/appointments/${parsed.data.appointment_id}`);
  return ok(undefined);
}

export async function saveDiagnosis(input: unknown): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = diagnosisSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  // Images round-trip through the client, so confirm we presigned them for Sir.
  if (!allKeysBelongTo(parsed.data.diagnosis_image_keys, user.id)) {
    return fail("One of those images couldn't be attached. Please re-upload.");
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("appointments")
    .update({
      diagnosis_notes: parsed.data.diagnosis_notes ?? null,
      diagnosis_image_keys: parsed.data.diagnosis_image_keys,
    })
    .eq("id", parsed.data.appointment_id);
  if (error) {
    console.error("saveDiagnosis failed:", error.code, error.message);
    if (error.message.includes("diagnosis_image_keys")) {
      return fail("Run migration 017 in Supabase, then try again.");
    }
    return fail("Couldn't save the notes.");
  }

  revalidatePath(`/admin/appointments/${parsed.data.appointment_id}`);
  return ok(undefined);
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: "completed" | "cancelled"
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(appointmentId);
  if (!id.success) return fail("Unknown appointment.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id.data);
  if (error) return fail("Couldn't update the appointment.");

  const admin = createSupabaseAdmin();

  // Cancelling frees the slot again, releases any checkpoint it was booked
  // for, and tells the student — by SMS and in-app — that Sir cancelled.
  if (status === "cancelled") {
    const { data: appt } = await admin
      .from("appointments")
      .select(
        "slot_id, student_id, is_follow_up, availability_slots(*), profiles(phone)"
      )
      .eq("id", id.data)
      .single();

    if (appt) {
      const row = appt as unknown as {
        slot_id: string;
        student_id: string;
        is_follow_up: boolean;
        availability_slots: AvailabilitySlot | null;
        profiles: { phone: string | null } | null;
      };

      await admin
        .from("availability_slots")
        .update({ status: "free" })
        .eq("id", row.slot_id);

      // Let the student rebook the "Meet with Sir" checkpoint.
      await admin
        .from("tasks")
        .update({ follow_up_appointment_id: null })
        .eq("follow_up_appointment_id", id.data);

      if (row.availability_slots) {
        if (row.profiles?.phone) {
          const res = await sendSms(
            row.profiles.phone,
            adminCancelledSms(row.availability_slots, row.is_follow_up),
            "MathDOC Booking"
          );
          if (!res.sent) {
            console.error(`Admin-cancel SMS failed for ${id.data}: ${res.error}`);
          }
        }
        await notify({
          userId: row.student_id,
          type: "booking_cancelled",
          title: "Sir cancelled your session",
          body: `${format(
            new Date(row.availability_slots.starts_at),
            "EEE d MMM 'at' h:mm a"
          )} — please book another time.`,
          link: "/student/book",
        });
      }
    }
  }

  // Completing a follow-up meeting ticks off its "Meet with Sir" checkpoint,
  // so the student's journey reflects that the meeting actually happened.
  if (status === "completed") {
    const { data: checkpoints } = await admin
      .from("tasks")
      .select("id, appointment_id, status")
      .eq("follow_up_appointment_id", id.data);
    for (const task of checkpoints ?? []) {
      if (task.status !== "approved") {
        await admin
          .from("tasks")
          .update({ status: "approved" })
          .eq("id", task.id);
        await recalcTaskStatuses(task.appointment_id);
      }
    }
  }

  revalidatePath(`/admin/appointments/${id.data}`);
  revalidatePath("/admin/appointments");
  revalidatePath("/student");
  revalidatePath("/student/sessions");
  revalidatePath("/student/profile");
  return ok(undefined);
}

// ---------------- Admin: slot editing ----------------

/** Change an existing free slot between in-person / online / either. */
export async function updateSlot(input: unknown): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = slotUpdateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("availability_slots")
    .update({ mode: parsed.data.mode })
    .eq("id", parsed.data.slot_id);
  if (error) return fail("Couldn't update the slot. Please try again.");

  revalidatePath("/admin/availability");
  return ok(undefined);
}

// ---------------- Admin: session notes ----------------

/** Add one note to a session; notes also show on the student's profile. */
export async function addSessionNote(
  input: unknown
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = sessionNoteSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { data: appt } = await supabase
    .from("appointments")
    .select("student_id")
    .eq("id", parsed.data.appointment_id)
    .maybeSingle();
  if (!appt) return fail("We couldn't find that session.");

  const { error } = await supabase.from("session_notes").insert({
    appointment_id: parsed.data.appointment_id,
    student_id: appt.student_id,
    body: parsed.data.body,
  });
  if (error) {
    console.error("addSessionNote failed:", error.code, error.message);
    // PGRST205 = PostgREST cannot find the table. Two different causes, and the
    // message must not assume the wrong one: either the table was never created
    // (the actual cause here — 005_session_notes.sql had not been applied), or
    // it exists but the schema cache is stale. Telling the operator to reload
    // the cache when the table is simply absent sends them in circles.
    if (error.code === "PGRST205" || error.message.includes("schema cache")) {
      return fail(
        "The session_notes table is missing from the database. Apply " +
          "supabase/migrations/020_session_notes_fix.sql in the Supabase SQL " +
          "editor — it creates the table and reloads the API schema cache."
      );
    }
    return fail("Couldn't save the note. Please try again.");
  }

  revalidatePath(`/admin/appointments/${parsed.data.appointment_id}`);
  revalidatePath(`/admin/students/${appt.student_id}`);
  revalidatePath("/student/profile");
  return ok(undefined);
}

export async function deleteSessionNote(
  noteId: string
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(noteId);
  if (!id.success) return fail("Unknown note.");

  const supabase = await createSupabaseServer();
  const { data: note } = await supabase
    .from("session_notes")
    .select("appointment_id, student_id")
    .eq("id", id.data)
    .maybeSingle();

  const { error } = await supabase
    .from("session_notes")
    .delete()
    .eq("id", id.data);
  if (error) return fail("Couldn't delete the note.");

  if (note) {
    revalidatePath(`/admin/appointments/${note.appointment_id}`);
    revalidatePath(`/admin/students/${note.student_id}`);
    revalidatePath("/student/profile");
  }
  return ok(undefined);
}
