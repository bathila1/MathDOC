import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { CategorySelect } from "@/features/students/client/CategorySelect";
import {
  QuizResultDialog,
  type QuizAnswer,
} from "@/features/exam/client/QuizResultDialog";
import { orderTasks, sessionNumbers } from "@/features/tasks/server/logic";
import { TaskManager, type AdminTask } from "@/features/tasks/client/TaskManager";
import { loadProofsByTask } from "@/features/tasks/server/proofs";
import { BackLink } from "@/components/site/BackLink";
import type {
  Appointment,
  AvailabilitySlot,
  Certificate,
  DefaultTask,
  McqAttempt,
  McqQuestion,
  Profile,
  SessionNote,
  Task,
} from "@/lib/shared/types";
import { formatPhone } from "@/lib/shared/phone";
import { activityStatus, ACTIVITY_META } from "@/lib/shared/activity";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Award, ExternalLink } from "lucide-react";

export const metadata = { title: "Student" };

type AppointmentWithSlot = Appointment & { availability_slots: AvailabilitySlot };

export default async function AdminStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user: adminUser } = await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: student } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();
  if (!student) notFound();
  const profile = student as Profile;

  const [
    { data: attempt },
    { data: appts },
    { data: tasks },
    { data: questions },
    { data: noteRows },
    { data: certRows },
    { data: templateRows },
  ] = await Promise.all([
    supabase
      .from("mcq_attempts")
      .select("*")
      .eq("student_id", id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("*, availability_slots(*)")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*, appointments!tasks_appointment_id_fkey(created_at)")
      .eq("student_id", id),
    supabase.from("mcq_questions").select("*"),
    supabase
      .from("session_notes")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("certificates")
      .select("*")
      .eq("student_id", id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("default_tasks")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const appointments = (appts ?? []) as AppointmentWithSlot[];
  const notes = (noteRows ?? []) as SessionNote[];
  const certificates = (certRows ?? []) as Certificate[];
  const defaultTasks = (templateRows ?? []) as DefaultTask[];

  const taskRows = (tasks ?? []) as (Task & {
    appointments: { created_at: string } | null;
  })[];
  const { data: sirNoteRows } = taskRows.length
    ? await supabase
        .from("task_sir_notes")
        .select("task_id, note")
        .in(
          "task_id",
          taskRows.map((r) => r.id)
        )
    : { data: [] };
  const sirNotes = new Map(
    ((sirNoteRows ?? []) as { task_id: string; note: string }[]).map((n) => [
      n.task_id,
      n.note,
    ])
  );
  const { data: msgRows } = taskRows.length
    ? await supabase
        .from("task_messages")
        .select("task_id")
        .in(
          "task_id",
          taskRows.map((r) => r.id)
        )
    : { data: [] };
  const chatCounts: Record<string, number> = {};
  for (const m of (msgRows ?? []) as { task_id: string }[]) {
    chatCounts[m.task_id] = (chatCounts[m.task_id] ?? 0) + 1;
  }

  const proofsByTask = await loadProofsByTask(
    supabase,
    taskRows.map((r) => r.id)
  );

  const sessionNos = sessionNumbers(taskRows);
  const studentTasks: AdminTask[] = orderTasks(taskRows).map((t) => ({
    ...t,
    sessionNo: sessionNos.get(t.appointment_id) ?? 1,
    sir_note: sirNotes.get(t.id) ?? "",
    proofs: proofsByTask.get(t.id) ?? [],
  }));
  const approved = studentTasks.filter((t) => t.status === "approved").length;
  const progress =
    studentTasks.length > 0
      ? Math.round((approved / studentTasks.length) * 100)
      : null;

  // Newest non-cancelled session — where tasks added from this page go.
  const latestAppointment = appointments
    .filter((a) => a.status !== "cancelled")
    .sort(
      (a, b) =>
        new Date(b.availability_slots.starts_at).getTime() -
        new Date(a.availability_slots.starts_at).getTime()
    )[0];
  const latestAppointmentId = latestAppointment?.id;
  const latestSessionDate = latestAppointment
    ? format(new Date(latestAppointment.availability_slots.starts_at), "d MMM yyyy")
    : null;

  const questionById = new Map(
    ((questions ?? []) as McqQuestion[]).map((q) => [q.id, q])
  );
  const mcqAttempt = attempt as McqAttempt | null;
  const quizAnswers: QuizAnswer[] = mcqAttempt
    ? Object.entries(mcqAttempt.answers).flatMap(([qid, chosen]) => {
        const q = questionById.get(qid);
        if (!q) return [];
        return [
          {
            question: q.text,
            chosen: q.options[chosen] ?? null,
            correct: q.options[q.correct_index],
            isCorrect: chosen === q.correct_index,
          },
        ];
      })
    : [];

  const appointmentById = new Map(appointments.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <BackLink href="/admin/students" label="All students" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            {profile.full_name ?? "Unregistered student"}
          </h1>
          {(() => {
            const status = activityStatus(
              profile.last_login_at,
              approved,
              studentTasks.length
            );
            const meta = ACTIVITY_META[status];
            return <Badge variant={meta.variant}>{meta.label}</Badge>;
          })()}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <CategorySelect studentId={profile.id} value={profile.category} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Phone:</span>{" "}
              {profile.phone ? formatPhone(profile.phone) : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">School:</span>{" "}
              {profile.school ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Grade:</span>{" "}
              {profile.grade ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Guardian:</span>{" "}
              {profile.guardian_name ?? "—"}{" "}
              {profile.guardian_phone
                ? `(${formatPhone(profile.guardian_phone)})`
                : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Address:</span>{" "}
              {profile.address ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Registered:</span>{" "}
              {format(new Date(profile.created_at), "d MMM yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Placement quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuizResultDialog
              score={profile.mcq_score}
              total={profile.mcq_total}
              answers={quizAnswers}
            />
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-sm text-muted-foreground">
                Set their level:
              </span>
              <CategorySelect studentId={profile.id} value={profile.category} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* One place to manage every task this student has, from any session */}
      <Card>
        <CardHeader>
          <CardTitle>
            Task journey{progress != null ? ` — ${progress}% complete` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress != null && <Progress value={progress} />}
          <TaskManager
            appointmentId={latestAppointmentId}
            tasks={studentTasks}
            defaultTasks={defaultTasks}
            currentUserId={adminUser.id}
            chatCounts={chatCounts}
            heading="All tasks"
          />
          {latestAppointmentId && (
            <p className="text-xs text-muted-foreground">
              New tasks are added to the latest session
              {latestSessionDate ? ` (${latestSessionDate})` : ""}. Drag any card
              to change the order of the whole journey.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session notes</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notes yet — add them from a session page.
            </p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => {
                const from = appointmentById.get(n.appointment_id);
                return (
                  <li key={n.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line">{n.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(n.created_at), "d MMM yyyy, h:mm a")}
                        {from && (
                          <>
                            {" · "}
                            <Link
                              href={`/admin/appointments/${n.appointment_id}`}
                              className="text-primary underline underline-offset-2"
                            >
                              from session{" "}
                              {format(
                                new Date(from.availability_slots.starts_at),
                                "d MMM"
                              )}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {certificates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Certificates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {certificates.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                size="sm"
                render={
                  <Link href={`/certificate/${c.public_token}`} target="_blank" />
                }
              >
                <Award className="size-4" />
                {format(new Date(c.issued_at), "d MMM yyyy")}
                <ExternalLink className="size-3.5" />
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            <ul className="space-y-2">
              {appointments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {format(
                        new Date(a.availability_slots.starts_at),
                        "EEE d MMM yyyy, h:mm a"
                      )}
                      {a.is_follow_up && (
                        <Badge variant="outline" className="ml-2">
                          Follow-up
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground capitalize">
                      {a.mode} · {a.status.replace("_", " ")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/admin/appointments/${a.id}`} />}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
