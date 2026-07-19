import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getDownloadUrl } from "@/lib/server/files";
import { ProofUploader } from "@/features/tasks/client/ProofUploader";
import type {
  Appointment,
  AvailabilitySlot,
  ProofSubmission,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Handshake,
  Hourglass,
} from "lucide-react";

export const metadata = { title: "Task" };

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireStudent();
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  const task = data as Task;
  if (task.status === "locked") notFound();

  const { data: proofRows } = await supabase
    .from("proof_submissions")
    .select("*")
    .eq("task_id", task.id)
    .order("submitted_at", { ascending: false });
  const proofs = (proofRows ?? []) as ProofSubmission[];
  const lastRejected = proofs.find((p) => p.status === "rejected");

  const attachmentUrl = task.attachment_key
    ? await getDownloadUrl(task.attachment_key)
    : null;

  type FollowUp = Appointment & { availability_slots: AvailabilitySlot };
  let followUp: FollowUp | null = null;
  if (task.type === "meet_sir" && task.follow_up_appointment_id) {
    const { data: fu } = await supabase
      .from("appointments")
      .select("*, availability_slots(*)")
      .eq("id", task.follow_up_appointment_id)
      .maybeSingle();
    followUp = (fu as FollowUp | null) ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/student" />}>
        <ArrowLeft className="size-4" /> Back to my plan
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {task.type === "meet_sir" && (
              <Badge variant="outline">
                <Handshake className="size-3" /> Meet with Sir
              </Badge>
            )}
            {task.status === "approved" && (
              <Badge variant="secondary">
                <CheckCircle2 className="size-3" /> Approved
              </Badge>
            )}
            {task.status === "proof_submitted" && (
              <Badge variant="destructive">
                <Hourglass className="size-3" /> Waiting for Sir&apos;s review
              </Badge>
            )}
          </div>
          <CardTitle>{task.title}</CardTitle>
          <CardDescription className="whitespace-pre-line">
            {task.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {attachmentUrl && (
            <Button
              variant="outline"
              render={<a href={attachmentUrl} target="_blank" rel="noreferrer" />}
            >
              <FileText className="size-4" /> Open the attached material
            </Button>
          )}

          {lastRejected?.teacher_note && task.status === "active" && (
            <Alert variant="destructive">
              <AlertTitle>Sir sent this back</AlertTitle>
              <AlertDescription>{lastRejected.teacher_note}</AlertDescription>
            </Alert>
          )}

          {task.type === "task" && task.status === "active" && (
            <ProofUploader taskId={task.id} />
          )}

          {task.type === "task" && task.status === "proof_submitted" && (
            <p className="rounded-md bg-muted p-4 text-sm">
              Your proof is with Sir. You&apos;ll be able to move to the next
              task once he accepts it.
            </p>
          )}

          {task.type === "meet_sir" && task.status !== "approved" && (
            <div className="space-y-3">
              {followUp && followUp.status !== "cancelled" ? (
                <p className="rounded-md bg-muted p-4 text-sm">
                  Your meeting with Sir is booked for{" "}
                  <strong>
                    {format(
                      new Date(followUp.availability_slots.starts_at),
                      "EEEE d MMMM, h:mm a"
                    )}
                  </strong>
                  . After you meet, Sir will unlock the next task.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Time to check in! Book a free follow-up meeting so Sir can
                    see how you&apos;re doing.
                  </p>
                  <Button
                    className="w-full"
                    render={<Link href={`/student/book?follow_up_task=${task.id}`} />}
                  >
                    <Handshake className="size-4" /> Meet with Sir again
                  </Button>
                </>
              )}
            </div>
          )}

          {task.status === "approved" && (
            <p className="rounded-md bg-muted p-4 text-sm">
              Done and approved — great work! Head back to your plan for the
              next task.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
