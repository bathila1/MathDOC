import "server-only";
import { formatSchoolDateTime } from "@/lib/shared/time";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { APP_NAME } from "@/lib/shared/constants";
import type {
  Appointment,
  AvailabilitySlot,
} from "@/lib/shared/types";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * Booking confirmation SMS.
 *
 * `invoiceToken` is accepted but intentionally NOT included: the invoice link
 * is withheld until the payment gateway is live (same rule as the confirmation
 * screen). Re-add the line below when payments go live.
 */
export async function buildBookingSms(
  appointment: Appointment,
  slot: AvailabilitySlot,
  invoiceToken: string | null
): Promise<string> {
  void invoiceToken;
  const when = formatSchoolDateTime(slot.starts_at);
  const lines = [
    `${APP_NAME}: Your ${appointment.is_follow_up ? "follow-up " : ""}session with Sir is confirmed.`,
    `Date: ${when}`,
    `Type: ${appointment.mode === "online" ? "Online" : "In person"}`,
  ];

  if (appointment.mode === "online") {
    lines.push(
      appointment.meeting_link
        ? `Join: ${appointment.meeting_link}`
        : "Sir will share the meeting link before the session."
    );
  } else {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("settings")
      .select("value")
      .eq("key", "location")
      .maybeSingle();
    if (data?.value) lines.push(`Location: ${data.value}`);
  }

  return lines.join("\n");
}

/** Sent to the student when Sir cancels their session from the admin side. */
export function adminCancelledSms(
  slot: AvailabilitySlot,
  isFollowUp: boolean
): string {
  const when = formatSchoolDateTime(slot.starts_at);
  return [
    `${APP_NAME}: Sir has cancelled your ${isFollowUp ? "follow-up " : ""}session on ${when}.`,
    "Please book another time on the app. Sorry for the inconvenience.",
  ].join("\n");
}

/** Sent to the student confirming they cancelled their own booking. */
export function studentCancelledSms(
  slot: AvailabilitySlot,
  isFollowUp: boolean
): string {
  const when = formatSchoolDateTime(slot.starts_at);
  return [
    `${APP_NAME}: Your ${isFollowUp ? "follow-up " : ""}session on ${when} has been cancelled.`,
    "You can book a new time on the app whenever you're ready.",
  ].join("\n");
}

export function certificateSms(token: string): string {
  return [
    `${APP_NAME}: Congratulations! You completed all your tasks.`,
    `Your certificate: ${appUrl(`/certificate/${token}`)}`,
  ].join("\n");
}
