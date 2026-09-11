import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import type { Appointment, AvailabilitySlot } from "@/lib/shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/site/BackLink";
import { BookedSessionCard } from "@/features/booking/client/BookedSessionCard";
import { formatSchool as format } from "@/lib/shared/time";

export const metadata = { title: "My sessions" };

type ApptRow = Appointment & { availability_slots: AvailabilitySlot };

export default async function SessionsPage() {
  const { user } = await requireStudent();
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("appointments")
    .select("*, availability_slots(*)")
    .eq("student_id", user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  // "Upcoming" = still to happen AND not already ticked off by Sir, so the
  // student sees the same state the teacher does.
  const upcoming = ((data ?? []) as ApptRow[])
    .filter(
      (a) =>
        a.status !== "completed" &&
        new Date(a.availability_slots.ends_at) > new Date()
    )
    .sort(
      (a, b) =>
        new Date(a.availability_slots.starts_at).getTime() -
        new Date(b.availability_slots.starts_at).getTime()
    );

  const finished = ((data ?? []) as ApptRow[])
    .filter(
      (a) =>
        a.status === "completed" ||
        new Date(a.availability_slots.ends_at) <= new Date()
    )
    .sort(
      (a, b) =>
        new Date(b.availability_slots.starts_at).getTime() -
        new Date(a.availability_slots.starts_at).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <BackLink href="/student" label="My plan" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
            Upcoming
          </p>
          <h1 className="mt-1 text-3xl">My sessions</h1>
        </div>
        <Button render={<Link href="/student/book" />}>Book a session</Button>
      </div>

      {upcoming.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No upcoming sessions. Book one and Sir will see you soon.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcoming.map((a) => (
            <BookedSessionCard
              key={a.id}
              session={{
                id: a.id,
                startsAt: a.availability_slots.starts_at,
                endsAt: a.availability_slots.ends_at,
                mode: a.mode,
                status: a.status,
                isFollowUp: a.is_follow_up,
                meetingLink: a.meeting_link,
              }}
            />
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Recently finished</h2>
          {finished.map((a) => (
            <Card key={a.id} className="bg-muted/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">
                    {format(
                      new Date(a.availability_slots.starts_at),
                      "EEE d MMM yyyy, h:mm a"
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.mode === "online" ? "Online" : "In person"}
                    {a.is_follow_up && " · Follow-up with Sir"}
                  </p>
                </div>
                <Badge variant={a.status === "completed" ? "default" : "outline"}>
                  {a.status === "completed" ? "Completed" : "Finished"}
                </Badge>
              </CardContent>
            </Card>
          ))}
          <p className="text-sm text-muted-foreground">
            See everything on your{" "}
            <Link
              href="/student/profile"
              className="text-primary underline underline-offset-4"
            >
              profile
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
