import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getAttemptForStudent } from "@/features/exam/server/queries";
import { orderTasks } from "@/features/tasks/server/logic";
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
  CalendarPlus,
  ChevronRight,
  Handshake,
  Hourglass,
  Lock,
  Pencil,
  Rocket,
  Sparkles,
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
      .select("*, appointments(created_at)")
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

  // ---- The game board: ALL tasks from ALL sessions, in one journey ----
  const allTasks = orderTasks((taskRes.data ?? []) as TaskRow[]);
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
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">
        Hi {profile.full_name?.split(" ")[0] ?? "there"}! 👋
      </h1>

      {!attempt && (
        <Card className="hover-lift border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> One small step first
            </CardTitle>
            <CardDescription>
              Take the short placement quiz so Sir knows exactly where you are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="bg-brand-gradient border-0 text-white" render={<Link href="/student/exam" />}>
              Start the quiz <ChevronRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {allTasks.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-transparent to-transparent">
            <CardTitle className="flex items-center gap-2 text-xl">
              🎯 My journey
            </CardTitle>
            <CardDescription>
              Every circle is a task from Sir. Finish them one by one to reach
              your certificate!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TaskTrack tasks={trackTasks} />

            {allDone && (
              <div className="animate-pop-in rounded-2xl bg-brand-gradient p-5 text-center text-white shadow-lg">
                <p className="text-2xl font-extrabold">🎉 Journey complete!</p>
                <p className="mt-1 text-sm opacity-90">
                  Every task approved. Amazing work!
                </p>
                {certificates[0] && (
                  <Button
                    variant="secondary"
                    className="mt-3"
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
                {/* Current task — the "Display task here" card from the sketch */}
                <Card className="hover-lift animate-pop-in border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-brand-gradient border-0 text-white">
                        <Rocket className="size-3" /> Current task
                      </Badge>
                      <Badge variant="outline">
                        Session {sessionRank.get(current.appointment_id)}
                      </Badge>
                      {current.type === "meet_sir" && (
                        <Badge variant="secondary">
                          <Handshake className="size-3" /> Meet with Sir
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="pt-1 text-lg">
                      {current.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3 whitespace-pre-line">
                      {current.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-brand-gradient border-0 text-white"
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
                          <Pencil className="size-4" /> Let&apos;s do it!
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Next task — teaser only */}
                {next ? (
                  <Card className="animate-pop-in border-dashed opacity-75">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Lock className="size-3" /> Up next
                        </Badge>
                        <Badge variant="outline">
                          Session {sessionRank.get(next.appointment_id)}
                        </Badge>
                      </div>
                      <CardTitle className="pt-1 text-lg text-muted-foreground">
                        {next.title}
                      </CardTitle>
                      <CardDescription>
                        🔒 Unlocks when you finish your current task. One step
                        at a time!
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <Card className="animate-pop-in border-dashed opacity-75">
                    <CardHeader>
                      <CardTitle className="text-lg text-muted-foreground">
                        🏁 This is your final task!
                      </CardTitle>
                      <CardDescription>
                        Finish it and your certificate is waiting.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📅 Upcoming sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {appointments.length === 0 ? (
            <div className="space-y-3 py-2 text-center">
              <p className="text-sm text-muted-foreground">
                No upcoming sessions.
              </p>
              <Button className="bg-brand-gradient border-0 text-white" render={<Link href="/student/book" />}>
                <CalendarPlus className="size-4" /> Book a session with Sir
              </Button>
            </div>
          ) : (
            appointments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="font-bold">
                    {format(
                      new Date(a.availability_slots.starts_at),
                      "EEE d MMM yyyy, h:mm a"
                    )}
                  </p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {a.mode === "online" ? "💻 Online" : "🤝 In person"}
                    {a.is_follow_up && " · Follow-up with Sir"}
                  </p>
                  {a.mode === "online" && a.meeting_link && (
                    <a
                      href={a.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-primary underline"
                    >
                      Join the meeting
                    </a>
                  )}
                </div>
                {a.status === "pending_payment" ? (
                  <Button size="sm" render={<Link href={`/student/book/payment/${a.id}`} />}>
                    Complete payment
                  </Button>
                ) : (
                  <Badge>Confirmed ✔</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {certificates.length > 0 && (
        <Card className="hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5 text-primary" /> My certificates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {certificates.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full justify-between"
                render={<Link href={`/certificate/${c.public_token}`} />}
              >
                🏅 Certificate — {format(new Date(c.issued_at), "d MMM yyyy")}
                <ChevronRight className="size-4" />
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
