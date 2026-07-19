import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { SlotPicker } from "@/features/booking/client/SlotPicker";
import type { AvailabilitySlot } from "@/lib/shared/types";
import { z } from "zod";

export const metadata = { title: "Book a session" };

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ follow_up_task?: string }>;
}) {
  await requireStudent();
  const { follow_up_task } = await searchParams;
  const followUpTaskId = z.string().uuid().safeParse(follow_up_task).success
    ? follow_up_task
    : undefined;

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("status", "free")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {followUpTaskId ? "Book your follow-up with Sir" : "Book a session"}
        </h1>
        <p className="text-muted-foreground">
          {followUpTaskId
            ? "Pick a free time to discuss your progress. Follow-up meetings are free."
            : "Pick how you want to meet and choose a free time."}
        </p>
      </div>
      <SlotPicker
        slots={(data ?? []) as AvailabilitySlot[]}
        followUpTaskId={followUpTaskId}
      />
    </div>
  );
}
