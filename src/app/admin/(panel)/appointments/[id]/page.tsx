import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import {
  MeetingLinkForm,
  DiagnosisForm,
  StatusButtons,
} from "@/features/booking/client/AppointmentAdminForms";
import { TaskManager, type AdminTask } from "@/features/tasks/client/TaskManager";
import { orderTasks, sessionNumbers } from "@/features/tasks/server/logic";
import { SessionNotes } from "@/features/booking/client/SessionNotes";
import { BackLink } from "@/components/site/BackLink";
import type {
  Appointment,
  AvailabilitySlot,
  Invoice,
  Profile,
  SessionNote,
  Task,
} from "@/lib/shared/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { formatPhone } from "@/lib/shared/phone";

export const metadata = { title: "Appointment" };

type Row = Appointment & {
  availability_slots: AvailabilitySlot;
  profiles: Profile;
  invoices: Invoice[];
};

export default async function AdminAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("appointments")
    .select("*, availability_slots(*), profiles(*), invoices(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const appt = data as Row;
  const slot = appt.availability_slots;
  const student = appt.profiles;
  const invoice = appt.invoices?.[0];

  // The student's WHOLE journey — tasks from every session, so previous
  // tasks can be viewed and managed from a follow-up appointment too.
  const { data: taskRows } = await supabase
    .from("tasks")
    .select("*, appointments!tasks_appointment_id_fkey(created_at)")
    .eq("student_id", appt.student_id);
  const { data: noteRows } = await supabase
    .from("session_notes")
    .select("*")
    .eq("appointment_id", id)
    .order("created_at", { ascending: false });
  const notes = (noteRows ?? []) as SessionNote[];

  const rows = (taskRows ?? []) as (Task & {
    appointments: { created_at: string } | null;
  })[];
  const sessionNos = sessionNumbers(rows);
  const tasks: AdminTask[] = orderTasks(rows).map((t) => ({
    ...t,
    sessionNo: sessionNos.get(t.appointment_id) ?? 1,
  }));

  return (
    <div className="space-y-6">
      <BackLink href="/admin/appointments" label="All appointments" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {format(new Date(slot.starts_at), "EEEE, d MMMM yyyy")}
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(slot.starts_at), "h:mm a")} –{" "}
            {format(new Date(slot.ends_at), "h:mm a")} ·{" "}
            <span className="capitalize">{appt.mode}</span>
            {appt.is_follow_up && " · Follow-up meeting"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="capitalize">{appt.status.replace("_", " ")}</Badge>
          <StatusButtons appointmentId={appt.id} status={appt.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-lg font-semibold">{student.full_name ?? "—"}</p>
            <p className="text-muted-foreground">
              {student.phone ? formatPhone(student.phone) : ""} ·{" "}
              {student.grade ?? ""}{" "}
              {student.category && <Badge variant="secondary">{student.category}</Badge>}
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/admin/students/${student.id}`} />}
              >
                Full profile
              </Button>
              {invoice && (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link href={`/invoice/${invoice.public_token}`} target="_blank" />
                  }
                >
                  Invoice ({invoice.status})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {appt.mode === "online" && (
              <MeetingLinkForm
                appointmentId={appt.id}
                initial={appt.meeting_link}
              />
            )}
            <DiagnosisForm
              appointmentId={appt.id}
              initial={appt.diagnosis_notes}
            />
          </CardContent>
        </Card>
      </div>

      {/* Notes added one by one — they follow the student to their profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Session notes
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              shown on {student.full_name ?? "the student"}&apos;s profile
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SessionNotes appointmentId={appt.id} notes={notes} />
        </CardContent>
      </Card>

      <Separator />

      <TaskManager
        appointmentId={appt.id}
        tasks={tasks}
        heading="Already existing tasks"
      />
    </div>
  );
}
