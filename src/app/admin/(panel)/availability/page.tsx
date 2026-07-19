import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { AvailabilityManager } from "@/features/booking/client/AvailabilityManager";
import type { AvailabilitySlot } from "@/lib/shared/types";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  await requireAdmin();
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("availability_slots")
    .select("*")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My availability</h1>
      <AvailabilityManager slots={(data ?? []) as AvailabilitySlot[]} />
    </div>
  );
}
