import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { issueCertificateIfComplete } from "@/features/certificates/server/issue";
import type { Task } from "@/lib/shared/types";

type TaskRow = Task & {
  appointments: { created_at: string } | null;
  proof_submissions: { id: string; status: string }[];
};

type OrderableTask = {
  sort_order: number;
  appointment_id: string;
  created_at?: string;
  appointments?: { created_at: string } | null;
};

/**
 * The journey is ONE global sequence per student: `sort_order` alone decides
 * the order, so the teacher can drag a task from a follow-up session in
 * front of an older one. New tasks are appended at the end.
 */
export function orderTasks<T extends OrderableTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1;
  });
}

/**
 * Session numbers are based on when each appointment happened (oldest = 1),
 * independent of task order — they are just a tag on the card.
 */
export function sessionNumbers<T extends OrderableTask>(
  tasks: T[]
): Map<string, number> {
  const created = new Map<string, string>();
  for (const t of tasks) {
    const c = t.appointments?.created_at ?? "";
    const existing = created.get(t.appointment_id);
    if (existing === undefined || c < existing) {
      created.set(t.appointment_id, c);
    }
  }
  const ordered = [...created.entries()].sort((a, b) =>
    a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : a[1] < b[1] ? -1 : 1
  );
  return new Map(ordered.map(([id], i) => [id, i + 1]));
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

  // Journey rules:
  //  - submitting a proof unlocks the next task straight away (no waiting
  //    on Sir's review); a rejection pulls the task back to `active`
  //  - "Meet with Sir" checkpoints never block progress — the student books
  //    the meeting and carries on with the next task meanwhile
  let blocked = false;
  const finalStatus = new Map<string, Task["status"]>();
  for (const task of tasks) {
    const hasPendingProof = task.proof_submissions?.some(
      (p) => p.status === "pending"
    );
    let next: Task["status"];

    if (task.status === "approved") {
      next = "approved";
    } else if (blocked) {
      next = "locked";
    } else if (hasPendingProof) {
      next = "proof_submitted";
    } else if (task.type === "meet_sir") {
      next = "active"; // open, but doesn't stop the next task unlocking
    } else {
      next = "active";
      blocked = true; // regular tasks hold the line until proof is sent
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
