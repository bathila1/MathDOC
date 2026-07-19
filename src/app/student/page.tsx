import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getAttemptForStudent } from "@/features/exam/server/queries";
import { orderTasks, recalcTaskStatuses } from "@/features/tasks/server/logic";
import { TaskTrack, type TrackTask } from "@/features/tasks/client/TaskTrack";
import type {
  Appointment,
  AvailabilitySlot,
  Certificate,
  Task,
} from "@/lib/shared/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Award,
  ChevronRight,
  Handshake,
  Hourglass,
  Lock,
  Pencil,
} from "lucide-react";

export const metadata = { title: "My plan" };

type ApptRow = Appointment & { availability_slots: AvailabilitySlot };
type TaskRow = Task & { appointments: { created_at: string } | null };

export default async function StudentDashboard() {
  const { user, profile } = await requireStudent();
  const supabase = await createSupabaseServer();

  const [attempt, apptRes, taskRes, certRes] = await Promise.all([
    getAttemptForStudent(user.id),
    supabase
      .from("appointments")
      .select("*, availability_slots(*)")
      .eq("student_id", user.id)
      .in("status", ["pending_payment", "confirmed"])
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*, appointments!tasks_appointment_id_fkey(created_at)")
      .eq("student_id", user.id),
    supabase
      .from("certificates")
      .select("*")
      .eq("student_id", user.id)
      .order("issued_at", { ascending: false }),
  ]);

  const appointments = ((apptRes.data ?? []) as ApptRow[]).filter(
    (a) => new Date(a.availability_slots.ends_at) > new Date()
  );
  const certificates = (certRes.data ?? []) as Certificate[];

  // ---- The journey: ALL tasks from ALL sessions, in one ordered line ----
  let allTasks = orderTasks((taskRes.data ?? []) as TaskRow[]);

  // Self-heal: if nothing is active but the journey isn't finished (e.g.
  // statuses got stuck), recalculate and refetch once.
  if (
    allTasks.length > 0 &&
    !allTasks.some((t) => t.status === "active" || t.status === "proof_submitted") &&
    !allTasks.every((t) => t.status === "approved")
  ) {
    await recalcTaskStatuses(allTasks[0].appointment_id);
    const again = await supabase
      .from("tasks")
      .select("*, appointments!tasks_appointment_id_fkey(created_at)")
      .eq("student_id", user.id);
    allTasks = orderTasks((again.data ?? []) as TaskRow[]);
  }

  const sessionRank = new Map<string, number>();
  for (const t of allTasks) {
    if (!sessionRank.has(t.appointment_id)) {
      sessionRank.set(t.appointment_id, sessionRank.size + 1);
    }
  }
  const trackTasks: TrackTask[] = allTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    type: t.type,
    sessionNo: sessionRank.get(t.appointment_id) ?? 1,
  }));

  const approved = allTasks.filter((t) => t.status === "approved").length;
  const allDone = allTasks.length > 0 && approved === allTasks.length;
  const currentIndex = allTasks.findIndex(
    (t) => t.status === "active" || t.status === "proof_submitted"
  );
  const current = currentIndex >= 0 ? allTasks[currentIndex] : null;
  const next = currentIndex >= 0 ? (allTasks[currentIndex + 1] ?? null) : null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
          My plan
        </p>
        <h1 className="mt-1 text-3xl">
          Hello, {profile.full_name?.split(" ")[0] ?? "there"}.
        </h1>
      </div>

      {!attempt && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>One small step first</CardTitle>
            <CardDescription>
              Take the short placement quiz so Sir knows exactly where you are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/student/exam" />}>
              Start the quiz
            </Button>
          </CardContent>
        </Card>
      )}

      {allTasks.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">Your journey</h2>
            <p className="text-sm text-muted-foreground">
              {approved} of {allTasks.length} tasks done
            </p>
          </div>
          <Card>
            <CardContent className="pt-5">
              <TaskTrack tasks={trackTasks} />
            </CardContent>
          </Card>

          {allDone && (
            <div className="animate-pop-in rounded-xl bg-brand-gradient p-6 text-center text-white shadow-md">
              <p className="text-2xl" style={{ fontFamily: "var(--font-fraunces), serif" }}>
                Journey complete 🎉
              </p>
              <p className="mt-1 text-sm opacity-90">
                Every task approved — wonderful work.
              </p>
              {certificates[0] && (
                <Button
                  variant="secondary"
                  className="mt-4"
                  render={
                    <Link href={`/certificate/${certificates[0].public_token}`} />
                  }
                >
                  <Award className="size-4" /> View your certificate
                </Button>
              )}
            </div>
          )}

          {current && (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Current task */}
              <Card className="border-primary/50">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Current task</Badge>
                    <Badge variant="outline">
                      Session {sessionRank.get(current.appointment_id)}
                    </Badge>
                    {current.type === "meet_sir" && (
                      <Badge variant="secondary">
                        <Handshake className="size-3" /> Meet with Sir
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="pt-2 text-lg">{current.title}</CardTitle>
                  <CardDescription className="line-clamp-3 whitespace-pre-line">
                    {current.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    render={<Link href={`/student/tasks/${current.id}`} />}
                  >
                    {current.status === "proof_submitted" ? (
                      <>
                        <Hourglass className="size-4" /> Waiting for Sir — view
                      </>
                    ) : current.type === "meet_sir" ? (
                      <>
                        <Handshake className="size-4" /> Book your meeting
                      </>
                    ) : (
                      <>
                        <Pencil className="size-4" /> Open this task
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Next task — teaser only */}
              {next ? (
                <Card className="border-dashed bg-muted/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <Lock className="size-3" /> Up next
                      </Badge>
                      <Badge variant="outline">
                        Session {sessionRank.get(next.appointment_id)}
                      </Badge>
                    </div>
                    <CardTitle className="pt-2 text-lg text-muted-foreground">
                      {next.title}
                    </CardTitle>
                    <CardDescription>
                      Unlocks when you finish the current task. One step at a
                      time.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <Card className="border-dashed bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-muted-foreground">
                      This is your final task
                    </CardTitle>
                    <CardDescription>
                      Finish it and your certificate is waiting.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl">Upcoming sessions</h2>
        <Card>
          <CardContent className="space-y-2 pt-5">
            {appointments.length === 0 ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No upcoming sessions.
                </p>
                <Button render={<Link href="/student/book" />}>
                  Book a session with Sir
                </Button>
              </div>
            ) : (
              appointments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
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
                    {a.mode === "online" && a.meeting_link && (
                      <a
                        href={a.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary underline underline-offset-4"
                      >
                        Join the meeting
                      </a>
                    )}
                  </div>
                  {a.status === "pending_payment" ? (
                    <Button
                      size="sm"
                      render={<Link href={`/student/book/payment/${a.id}`} />}
                    >
                      Complete payment
                    </Button>
                  ) : (
                    <Badge variant="secondary">Confirmed</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {certificates.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl">My certificates</h2>
          <Card>
            <CardContent className="space-y-2 pt-5">
              {certificates.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-between"
                  render={<Link href={`/certificate/${c.public_token}`} />}
                >
                  <span className="flex items-center gap-2">
                    <Award className="size-4 text-primary" />
                    Certificate — {format(new Date(c.issued_at), "d MMM yyyy")}
                  </span>
                  <ChevronRight className="size-4" />
                </Button>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
