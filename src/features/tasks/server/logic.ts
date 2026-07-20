import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { issueCertificateIfComplete } from "@/features/certificates/server/issue";
import type { Task } from "@/lib/shared/types";

type TaskRow = Task & {
  appointments: { created_at: string } | null;
  proof_submissions: { id: string; status: string }[];
};

/** Global game order: session (appointment) age first, then task order. */
export function orderTasks<T extends { sort_order: number; appointment_id: string; appointments?: { created_at: string } | null }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    const ca = a.appointments?.created_at ?? "";
    const cb = b.appointments?.created_at ?? "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    if (a.appointment_id !== b.appointment_id)
      return a.appointment_id < b.appointment_id ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

/**
 * The task-game rule, applied after every change, across ALL of the
 * student's appointments (old tasks are never removed — new sessions
 * append to the same journey): everything before the first unfinished
 * task is approved; that task is `active` (or `proof_submitted` while a
 * proof awaits review); everything after stays `locked`.
 */
export async function recalcTaskStatuses(appointmentId: string): Promise<void> {
  const admin = createSupabaseAdmin();

  const { data: appt } = await admin
    .from("appointments")
    .select("student_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;

  const { data } = await admin
    .from("tasks")
    // tasks has TWO fks to appointments — name the one we mean, or the
    // embed is ambiguous and the whole query errors out.
    .select(
      "*, appointments!tasks_appointment_id_fkey(created_at), proof_submissions(id, status)"
    )
    .eq("student_id", appt.student_id);

  const tasks = orderTasks((data ?? []) as TaskRow[]);
  if (tasks.length === 0) return;

  // Submitting a proof already unlocks the next task — the student never
  // waits on Sir's review to keep moving. Rejection pulls the task back to
  // `active`, making it the current task again.
  let unlocked = true; // first task that is neither approved nor submitted
  const finalStatus = new Map<string, Task["status"]>();
  for (const task of tasks) {
    let next: Task["status"];
    const hasPendingProof = task.proof_submissions?.some(
      (p) => p.status === "pending"
    );
    if (task.status === "approved") {
      next = "approved";
    } else if (hasPendingProof) {
      next = "proof_submitted";
    } else if (unlocked) {
      next = "active";
      unlocked = false;
    } else {
      next = "locked";
    }
    finalStatus.set(task.id, next);
    if (next !== task.status) {
      await admin.from("tasks").update({ status: next }).eq("id", task.id);
    }
  }

  // A certificate per completed session (appointment).
  const appointmentIds = [...new Set(tasks.map((t) => t.appointment_id))];
  for (const id of appointmentIds) {
    const own = tasks.filter((t) => t.appointment_id === id);
    if (own.every((t) => finalStatus.get(t.id) === "approved")) {
      await issueCertificateIfComplete(id);
    }
  }
}
