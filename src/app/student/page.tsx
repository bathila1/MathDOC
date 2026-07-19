import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getAttemptForStudent } from "@/features/exam/server/queries";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Circle,
  Handshake,
  Hourglass,
  Lock,
} from "lucide-react";

export const metadata = { title: "My plan" };

type ApptRow = Appointment & { availability_slots: AvailabilitySlot };

const taskIcon: Record<Task["status"], React.ReactNode> = {
  approved: <CheckCircle2 className="size-5 text-green-600" />,
  active: <Circle className="size-5 text-primary" />,
  proof_submitted: <Hourglass className="size-5 text-amber-500" />,
  locked: <Lock className="size-5 text-muted-foreground" />,
};

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
      .select("*")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("certificates")
      .select("*")
      .eq("student_id", user.id)
      .order("issued_at", { ascending: false }),
  ]);

  const appointments = ((apptRes.data ?? []) as ApptRow[]).filter(
    (a) => new Date(a.availability_slots.ends_at) > new Date()
  );
  const allTasks = (taskRes.data ?? []) as Task[];
  const certificates = (certRes.data ?? []) as Certificate[];

  // Current plan = tasks of the most recent appointment that has tasks
  const planAppointmentId = allTasks[0]?.appointment_id;
  const plan = allTasks
    .filter((t) => t.appointment_id === planAppointmentId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const approved = plan.filter((t) => t.status === "approved").length;
  const progress = plan.length ? Math.round((approved / plan.length) * 100) : 0;
  const planDone = plan.length > 0 && approved === plan.length;
  const planCertificate = planDone
    ? certificates.find((c) => c.appointment_id === planAppointmentId)
    : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Hi {profile.full_name?.split(" ")[0] ?? "there"}! 👋
      </h1>

      {!attempt && (
        <Card className="border-primary">
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

      {plan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>My improvement plan</span>
              <span className="text-2xl font-bold text-primary">{progress}%</span>
            </CardTitle>
            <CardDescription>
              {planDone
                ? "All tasks complete — amazing work! 🎉"
                : `${approved} of ${plan.length} tasks approved. Keep going!`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-4" />
            {planCertificate && (
              <Button
                className="w-full"
                render={<Link href={`/certificate/${planCertificate.public_token}`} />}
              >
                <Award className="size-4" /> View your certificate
              </Button>
            )}
            <ol className="space-y-2">
              {plan.map((t, i) => (
                <li key={t.id}>
                  <Link
                    href={t.status === "locked" ? "#" : `/student/tasks/${t.id}`}
                    aria-disabled={t.status === "locked"}
                    className={`flex items-center gap-3 rounded-md border p-3 ${
                      t.status === "locked"
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {taskIcon[t.status]}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {i + 1}. {t.title}
                      </p>
                      {t.type === "meet_sir" && (
                        <Badge variant="outline" className="mt-0.5">
                          <Handshake className="size-3" /> Meet with Sir
                        </Badge>
                      )}
                    </div>
                    {t.status !== "locked" && (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {appointments.length === 0 ? (
            <div className="space-y-3 py-2 text-center">
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
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">
                    {format(
                      new Date(a.availability_slots.starts_at),
                      "EEE d MMM yyyy, h:mm a"
                    )}
                  </p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {a.mode === "online" ? "Online" : "In person"}
                    {a.is_follow_up && " · Follow-up with Sir"}
                  </p>
                  {a.mode === "online" && a.meeting_link && (
                    <a
                      href={a.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
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
                  <Badge>Confirmed</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {certificates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5" /> My certificates
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
                Certificate — {format(new Date(c.issued_at), "d MMM yyyy")}
                <ChevronRight className="size-4" />
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
