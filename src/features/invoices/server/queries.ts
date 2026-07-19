import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import type {
  Appointment,
  AvailabilitySlot,
  Invoice,
  Profile,
} from "@/lib/shared/types";

export interface InvoiceView {
  invoice: Invoice;
  appointment: Appointment;
  slot: AvailabilitySlot;
  student: Pick<Profile, "full_name" | "phone" | "address">;
}

/**
 * Public invoice lookup — the unguessable token IS the credential, so this
 * runs on the service role but exposes only this invoice's data.
 */
export async function getInvoiceByToken(
  token: string
): Promise<InvoiceView | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("invoices")
    .select(
      "*, appointments(*, availability_slots(*), profiles(full_name, phone, address))"
    )
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;

  const { appointments, ...invoice } = data as Invoice & {
    appointments: Appointment & {
      availability_slots: AvailabilitySlot;
      profiles: Pick<Profile, "full_name" | "phone" | "address">;
    };
  };
  const { availability_slots, profiles, ...appointment } = appointments;

  return {
    invoice: invoice as Invoice,
    appointment: appointment as Appointment,
    slot: availability_slots,
    student: profiles,
  };
}
