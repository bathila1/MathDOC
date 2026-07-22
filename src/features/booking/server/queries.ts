import "server-only";
import { createSupabaseServer } from "@/lib/server/supabase";
import type { Appointment, AvailabilitySlot } from "@/lib/shared/types";

export type ActiveBooking = Appointment & {
  availability_slots: AvailabilitySlot;
};

/**
 * A student may only hold ONE live booking at a time: an appointment that
 * isn't cancelled, hasn't been marked completed, and hasn't finished yet.
 * Returns it (with its slot) or null.
 */
export async function getActiveBooking(
  studentId: string
): Promise<ActiveBooking | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("appointments")
    .select("*, availability_slots(*)")
    .eq("student_id", studentId)
    .in("status", ["pending_payment", "confirmed"]);

  const now = Date.now();
  const live = ((data ?? []) as ActiveBooking[])
    .filter((a) => new Date(a.availability_slots.ends_at).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.availability_slots.starts_at).getTime() -
        new Date(b.availability_slots.starts_at).getTime()
    );

  return live[0] ?? null;
}
