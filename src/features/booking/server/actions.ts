"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getAuth, requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { sendSms } from "@/lib/server/sms";
import { buildBookingSms } from "./sms";
import {
  bookingSchema,
  slotSchema,
  meetingLinkSchema,
  diagnosisSchema,
} from "@/lib/shared/schemas";
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
  const { date, start_time, end_time, mode } = parsed.data;

  const starts_at = new Date(`${date}T${start_time}:00`);
  const ends_at = new Date(`${date}T${end_time}:00`);
  if (starts_at <= new Date()) {
    return fail("Please pick a time in the future.", {
      date: "Please pick a time in the future.",
    });
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("availability_slots").insert({
    starts_at: starts_at.toISOString(),
    ends_at: ends_at.toISOString(),
    mode,
  });
  if (error) return fail("Couldn't add the slot. Please try again.");

  revalidatePath("/admin/availability");
  return ok(undefined);
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
  if (error) return fail("Couldn't delete the slot.");

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

/** Loads appointment + slot + invoice and sends the confirmation SMS. */
async function sendBookingSms(appointmentId: string): Promise<string | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("appointments")
    .select("*, availability_slots(*), invoices(*), profiles(phone)")
    .eq("id", appointmentId)
    .single();
  if (!data) return null;

  const appt = data as Appointment & {
    availability_slots: AvailabilitySlot;
    invoices: Invoice[] | Invoice | null;
    profiles: { phone: string | null };
  };
  const invoice = Array.isArray(appt.invoices)
    ? appt.invoices[0]
    : appt.invoices;
  const token = invoice?.public_token ?? null;

  const phone = appt.profiles?.phone;
  if (phone) {
    const message = await buildBookingSms(appt, appt.availability_slots, token);
    await sendSms(phone, message);
  }
  return token;
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

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("appointments")
    .update({ diagnosis_notes: parsed.data.diagnosis_notes ?? null })
    .eq("id", parsed.data.appointment_id);
  if (error) return fail("Couldn't save the notes.");

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

  // Cancelling frees the slot again
  if (status === "cancelled") {
    const admin = createSupabaseAdmin();
    const { data: appt } = await admin
      .from("appointments")
      .select("slot_id")
      .eq("id", id.data)
      .single();
    if (appt) {
      await admin
        .from("availability_slots")
        .update({ status: "free" })
        .eq("id", appt.slot_id);
    }
  }

  revalidatePath(`/admin/appointments/${id.data}`);
  revalidatePath("/admin/appointments");
  return ok(undefined);
}
