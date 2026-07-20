import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { CategorySelect } from "@/features/students/client/CategorySelect";
import { orderTasks, sessionNumbers } from "@/features/tasks/server/logic";
import { TaskManager, type AdminTask } from "@/features/tasks/client/TaskManager";
import type {
  Appointment,
  AvailabilitySlot,
  McqAttempt,
  McqQuestion,
  Profile,
  Task,
} from "@/lib/shared/types";
import { formatPhone } from "@/lib/shared/phone";
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

export const metadata = { title: "Student" };

type AppointmentWithSlot = Appointment & { availability_slots: AvailabilitySlot };

export default async function AdminStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
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

  const [{ data: attempt }, { data: appts }, { data: tasks }, { data: questions }] =
    await Promise.all([
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
    ]);

  const appointments = (appts ?? []) as AppointmentWithSlot[];
  const taskRows = (tasks ?? []) as (Task & {
    appointments: { created_at: string } | null;
  })[];
  const sessionNos = sessionNumbers(taskRows);
  const studentTasks: AdminTask[] = orderTasks(taskRows).map((t) => ({
    ...t,
    sessionNo: sessionNos.get(t.appointment_id) ?? 1,
  }));
  const approved = studentTasks.filter((t) => t.status === "approved").length;
  const progress =
    studentTasks.length > 0
      ? Math.round((approved / studentTasks.length) * 100)
      : null;
  const questionById = new Map(
    ((questions ?? []) as McqQuestion[]).map((q) => [q.id, q])
  );
  const mcqAttempt = attempt as McqAttempt | null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {profile.full_name ?? "Unregistered student"}
        </h1>
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
            <p><span className="text-muted-foreground">Phone:</span> {profile.phone ? formatPhone(profile.phone) : "—"}</p>
            <p><span className="text-muted-foreground">School:</span> {profile.school ?? "—"}</p>
            <p><span className="text-muted-foreground">Grade:</span> {profile.grade ?? "—"}</p>
            <p><span className="text-muted-foreground">Guardian:</span> {profile.guardian_name ?? "—"}{" "}
              {profile.guardian_phone ? `(${formatPhone(profile.guardian_phone)})` : ""}</p>
            <p><span className="text-muted-foreground">Address:</span> {profile.address ?? "—"}</p>
            <p><span className="text-muted-foreground">Registered:</span> {format(new Date(profile.created_at), "d MMM yyyy")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Placement quiz{" "}
              {profile.mcq_score != null && (
                <Badge variant="secondary" className="ml-2">
                  {profile.mcq_score}/{profile.mcq_total}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!mcqAttempt ? (
              <p className="text-muted-foreground">Not attempted yet.</p>
            ) : (
              Object.entries(mcqAttempt.answers).map(([qid, chosen]) => {
                const q = questionById.get(qid);
                if (!q) return null;
                const correct = chosen === q.correct_index;
                return (
                  <div key={qid}>
                    <p className="font-medium">{q.text}</p>
                    <p className={correct ? "text-green-600" : "text-destructive"}>
                      {correct ? "✓" : "✗"} {q.options[chosen] ?? "—"}
                      {!correct && (
                        <span className="text-muted-foreground">
                          {" "}(correct: {q.options[q.correct_index]})
                        </span>
                      )}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Task journey{progress != null ? ` — ${progress}% complete` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress != null && <Progress value={progress} />}
          <TaskManager tasks={studentTasks} heading="All tasks" />
        </CardContent>
      </Card>

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
                      {format(new Date(a.availability_slots.starts_at), "EEE d MMM yyyy, h:mm a")}
                      {a.is_follow_up && (
                        <Badge variant="outline" className="ml-2">Follow-up</Badge>
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
