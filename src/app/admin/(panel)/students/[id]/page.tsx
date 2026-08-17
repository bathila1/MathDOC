import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { CategorySelect } from "@/features/students/client/CategorySelect";
import { DeleteStudentButton } from "@/features/students/client/StudentAdminControls";
import { SurveyHistory } from "@/features/survey/client/SurveyHistory";
import {
  getAllSurveyQuestions,
  getSurveyHistory,
} from "@/features/survey/server/queries";
import { orderTasks, sessionNumbers } from "@/features/tasks/server/logic";
import { TaskManager, type AdminTask } from "@/features/tasks/client/TaskManager";
import { loadProofsByTask } from "@/features/tasks/server/proofs";
import { StudentTeacherNotes } from "@/features/students/client/StudentTeacherNotes";
import { BackLink } from "@/components/site/BackLink";
import type {
  Appointment,
  AvailabilitySlot,
  Certificate,
  DefaultTask,
  Profile,
  SessionNote,
  StudentTeacherNote,
  Task,
} from "@/lib/shared/types";
import { formatPhone } from "@/lib/shared/phone";
import { activityStatus, ACTIVITY_META } from "@/lib/shared/activity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Award, ExternalLink, Lock } from "lucide-react";

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

  // One parallel wave for the profile and everything else keyed off the URL's
  // student id (none of these depend on each other). Folding the profile lookup
  // in here — instead of awaiting it first — removes a whole round-trip; if the
  // student turns out not to exist we just notFound() after.
  const [
    { data: student },
    surveyResponses,
    { data: appts },
    { data: tasks },
    surveyQuestions,
    { data: noteRows },
    { data: certRows },
    { data: templateRows },
    { data: teacherNoteRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("role", "student")
      .maybeSingle(),
    getSurveyHistory(id),
    supabase
      .from("appointments")
      .select("*, availability_slots(*)")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*, appointments!tasks_appointment_id_fkey(created_at)")
      .eq("student_id", id),
    getAllSurveyQuestions(),
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
    supabase
      .from("student_teacher_notes")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!student) notFound();
  const profile = student as Profile;
  const appointments = (appts ?? []) as AppointmentWithSlot[];
  const notes = (noteRows ?? []) as SessionNote[];
  const certificates = (certRows ?? []) as Certificate[];
  const defaultTasks = (templateRows ?? []) as DefaultTask[];
  const teacherNotes = (teacherNoteRows ?? []) as StudentTeacherNote[];

  const taskRows = (tasks ?? []) as (Task & {
    appointments: { created_at: string } | null;
  })[];
  const taskIds = taskRows.map((r) => r.id);

  // Sir-notes, chat counts and proofs all key off the task ids — fetch them
  // together in one wave instead of three sequential round-trips.
  const [sirNoteRes, msgRes, proofsByTask] = await Promise.all([
    taskIds.length
      ? supabase.from("task_sir_notes").select("task_id, note").in("task_id", taskIds)
      : Promise.resolve({ data: [] as { task_id: string; note: string }[] }),
    taskIds.length
      ? supabase
          .from("task_messages")
          .select("task_id, sender_role, seen_by_admin")
          .in("task_id", taskIds)
      : Promise.resolve({
          data: [] as {
            task_id: string;
            sender_role: string;
            seen_by_admin: boolean;
          }[],
        }),
    loadProofsByTask(supabase, taskIds),
  ]);

  const sirNotes = new Map(
    ((sirNoteRes.data ?? []) as { task_id: string; note: string }[]).map((n) => [
      n.task_id,
      n.note,
    ])
  );
  const unseenChats = Array.from(
    new Set(
      (
        (msgRes.data ?? []) as {
          task_id: string;
          sender_role: string;
          seen_by_admin: boolean;
        }[]
      )
        .filter((m) => m.sender_role === "student" && !m.seen_by_admin)
        .map((m) => m.task_id)
    )
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <CategorySelect studentId={profile.id} value={profile.category} />
          <DeleteStudentButton
            studentId={profile.id}
            studentName={profile.full_name ?? "Unregistered student"}
          />
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
            <CardTitle>Student level</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Set their level:
              </span>
              <CategorySelect studentId={profile.id} value={profile.category} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Survey answers over time — the whole reason it is re-asked */}
      <Card>
        <CardHeader>
          <CardTitle>Survey answers</CardTitle>
          <CardDescription>
            Filled in before every booking. Numbers show the change since the
            previous session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SurveyHistory
            questions={surveyQuestions}
            responses={surveyResponses}
          />
        </CardContent>
      </Card>

      {/* Private, admin-only notes about this student */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" /> Private notes
          </CardTitle>
          <CardDescription>
            Only you can see these — never shown to the student.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentTeacherNotes studentId={profile.id} notes={teacherNotes} />
        </CardContent>
      </Card>

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
            unseenChats={unseenChats}
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
