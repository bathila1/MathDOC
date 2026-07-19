import "server-only";
import { format } from "date-fns";
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

/** Booking confirmation SMS with all details + the invoice link. */
export async function buildBookingSms(
  appointment: Appointment,
  slot: AvailabilitySlot,
  invoiceToken: string | null
): Promise<string> {
  const when = format(new Date(slot.starts_at), "EEE d MMM yyyy 'at' h:mm a");
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

  if (invoiceToken) {
    lines.push(`Invoice: ${appUrl(`/invoice/${invoiceToken}`)}`);
  }
  return lines.join("\n");
}

export function certificateSms(token: string): string {
  return [
    `${APP_NAME}: Congratulations! You completed all your tasks.`,
    `Your certificate: ${appUrl(`/certificate/${token}`)}`,
  ].join("\n");
}
