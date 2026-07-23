import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getAttemptForStudent } from "@/features/exam/server/queries";
import { getActiveBooking } from "@/features/booking/server/queries";
import { BookedSessionCard } from "@/features/booking/client/BookedSessionCard";
import {
  needsRecalc,
  orderTasks,
  recalcTaskStatuses,
} from "@/features/tasks/server/logic";
import { getDownloadUrl } from "@/lib/server/files";
import {
  JourneyBoard,
  type BoardTask,
} from "@/features/tasks/client/JourneyBoard";
import type { Certificate, ProofSubmission, Task } from "@/lib/shared/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";

export const metadata = { title: "My plan" };

type TaskRow = Task & { appointments: { created_at: string } | null };

export default async function StudentDashboard() {
  const { user, profile } = await requireStudent();
  const supabase = await createSupabaseServer();

  const [attempt, booking, taskRes, certRes, proofRes] = await Promise.all([
    getAttemptForStudent(user.id),
    getActiveBooking(user.id),
    supabase
      .from("tasks")
      .select("*, appointments!tasks_appointment_id_fkey(created_at)")
      .eq("student_id", user.id),
    supabase
      .from("certificates")
      .select("*")
      .eq("student_id", user.id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("proof_submissions")
      .select("*")
      .eq("student_id", user.id)
      .order("submitted_at", { ascending: false }),
  ]);

  let allTasks = orderTasks((taskRes.data ?? []) as TaskRow[]);
  const certificates = (certRes.data ?? []) as Certificate[];
  const proofs = (proofRes.data ?? []) as ProofSubmission[];

  // Self-heal: repair any status that disagrees with the journey rules
  // (e.g. tasks left locked behind a Meet-with-Sir checkpoint).
  const pendingByTask = new Set(
    proofs.filter((p) => p.status === "pending").map((p) => p.task_id)
  );
  if (
    allTasks.length > 0 &&
    needsRecalc(
      allTasks.map((t) => ({ ...t, hasPendingProof: pendingByTask.has(t.id) }))
    )
  ) {
    await recalcTaskStatuses(allTasks[0].appointment_id);
    const again = await supabase
      .from("tasks")
      .select("*, appointments!tasks_appointment_id_fkey(created_at)")
      .eq("student_id", user.id);
    allTasks = orderTasks((again.data ?? []) as TaskRow[]);
  }

  // Session number per appointment, in journey order
  const sessionRank = new Map<string, number>();
  for (const t of allTasks) {
    if (!sessionRank.has(t.appointment_id)) {
      sessionRank.set(t.appointment_id, sessionRank.size + 1);
    }
  }

  // Latest proof per task → rejection note when it was sent back
  const latestProof = new Map<string, ProofSubmission>();
  for (const p of proofs) {
    if (!latestProof.has(p.task_id)) latestProof.set(p.task_id, p);
  }

  // Booked follow-up meetings for meet_sir checkpoints
  const followUpIds = allTasks
    .map((t) => t.follow_up_appointment_id)
    .filter((id): id is string => Boolean(id));
  const followUpAt = new Map<string, string>();
  if (followUpIds.length > 0) {
    const { data: fu } = await supabase
      .from("appointments")
      .select("id, status, availability_slots(starts_at)")
      .in("id", followUpIds);
    for (const a of (fu ?? []) as unknown as {
      id: string;
      status: string;
      availability_slots: { starts_at: string } | null;
    }[]) {
      if (a.status !== "cancelled" && a.availability_slots) {
        followUpAt.set(a.id, a.availability_slots.starts_at);
      }
    }
  }

  const boardTasks: BoardTask[] = await Promise.all(
    allTasks.map(async (t) => {
      const proof = latestProof.get(t.id);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        type: t.type,
        sessionNo: sessionRank.get(t.appointment_id) ?? 1,
        attachmentUrl: t.attachment_key
          ? await getDownloadUrl(t.attachment_key)
          : null,
        rejectionNote:
          proof?.status === "rejected" ? (proof.teacher_note ?? null) : null,
        followUpAt: t.follow_up_appointment_id
          ? (followUpAt.get(t.follow_up_appointment_id) ?? null)
          : null,
        isPriority: t.is_priority,
        timerSeconds: t.timer_seconds,
        dueAt: t.due_at,
        youtubeUrl: t.youtube_url,
        facebookUrl: t.facebook_url,
        videoUrl: t.video_key ? await getDownloadUrl(t.video_key) : null,
        voiceUrl: t.voice_key ? await getDownloadUrl(t.voice_key) : null,
        questionImageUrl: t.question_image_key
          ? await getDownloadUrl(t.question_image_key)
          : null,
      };
    })
  );

  const approved = allTasks.filter((t) => t.status === "approved").length;
  const allDone = allTasks.length > 0 && approved === allTasks.length;

  return (
    <div className="space-y-6">
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

      {/* The student's one live booking. The "no session booked" prompt only
          shows during onboarding (no tasks yet) — once tasks exist it's hidden,
          since the journey board is the focus and already links to booking. */}
      {booking ? (
        <section className="space-y-3">
          <h2 className="text-xl">Your next session</h2>
          <BookedSessionCard
            session={{
              id: booking.id,
              startsAt: booking.availability_slots.starts_at,
              endsAt: booking.availability_slots.ends_at,
              mode: booking.mode,
              status: booking.status,
              isFollowUp: booking.is_follow_up,
              meetingLink: booking.meeting_link,
            }}
          />
        </section>
      ) : allTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              You have no session booked at the moment.
            </p>
            <Button size="sm" render={<Link href="/student/book" />}>
              Book a session
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {allDone && (
        <div className="animate-pop-in rounded-xl bg-brand-gradient p-6 text-center text-white shadow-md">
          <p className="font-heading text-2xl font-bold">Journey complete 🎉</p>
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

      {allTasks.length > 0 ? (
        <JourneyBoard tasks={boardTasks} />
      ) : (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No tasks yet</CardTitle>
            <CardDescription>
              Your journey starts after your first session — Sir will set your
              personal tasks there.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button render={<Link href="/student/book" />}>
              Book a session with Sir
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
