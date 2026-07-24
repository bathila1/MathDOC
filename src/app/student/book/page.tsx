import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getActiveBooking } from "@/features/booking/server/queries";
import { StudentSlotCalendar } from "@/features/booking/client/calendar/StudentSlotCalendar";
import { BookedSessionCard } from "@/features/booking/client/BookedSessionCard";
import { BackLink } from "@/components/site/BackLink";
import { Button } from "@/components/ui/button";
import type { AvailabilitySlot } from "@/lib/shared/types";
import { z } from "zod";

export const metadata = { title: "Book a session" };

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ follow_up_task?: string }>;
}) {
  const { user } = await requireStudent();
  const { follow_up_task } = await searchParams;
  const followUpTaskId = z.string().uuid().safeParse(follow_up_task).success
    ? follow_up_task
    : undefined;

  // One live booking at a time — show it instead of the calendar.
  const active = await getActiveBooking(user.id);
  if (active) {
    return (
      <div className="space-y-6">
        <BackLink href="/student" label="My plan" />
        <div>
          <h1 className="text-3xl">You already have a session booked</h1>
          <p className="text-muted-foreground">
            You can only hold one booking at a time. Cancel this one if you
            need a different time.
          </p>
        </div>
        <BookedSessionCard
          session={{
            id: active.id,
            startsAt: active.availability_slots.starts_at,
            endsAt: active.availability_slots.ends_at,
            mode: active.mode,
            status: active.status,
            isFollowUp: active.is_follow_up,
            meetingLink: active.meeting_link,
          }}
        />
        <Button variant="outline" render={<Link href="/student/sessions" />}>
          View my sessions
        </Button>
      </div>
    );
  }

  const supabase = await createSupabaseServer();
  // Include booked slots too — they show dimmed so students see what's taken.
  const { data } = await supabase
    .from("availability_slots")
    .select("*")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return (
    <div className="space-y-6">
      <BackLink href="/student" label="My plan" />
      <div>
        <h1 className="text-3xl">
          {followUpTaskId ? "Book your follow-up with Sir" : "Book a session"}
        </h1>
        <p className="text-muted-foreground">
          {followUpTaskId
            ? "Pick a free time to talk about your progress. Follow-up meetings are free."
            : "Choose how you want to meet, then tap a free time on the calendar."}
        </p>
      </div>
      <StudentSlotCalendar
        slots={(data ?? []) as AvailabilitySlot[]}
        followUpTaskId={followUpTaskId}
      />
    </div>
  );
}
