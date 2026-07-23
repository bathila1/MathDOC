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

export interface StatusInput {
  id: string;
  status: Task["status"];
  type: Task["type"];
  sort_order: number;
  appointment_id: string;
  created_at?: string;
  appointments?: { created_at: string } | null;
  hasPendingProof?: boolean;
}

/**
 * The single source of truth for the journey rules (pure — no database):
 *  - tasks run in one global order per student, shown as a sequence, but
 *    NOTHING is ever locked: a student can do them in any order and, if one
 *    is too hard, flag it and move on (see `student_flag`)
 *  - a task with a pending proof shows as `proof_submitted` until Sir reviews
 *  - an approved task stays `approved`
 * The `locked` status is retained in the type only for old data; recalc never
 * produces it, and any stored `locked` row is normalised to `active`.
 */
export function computeJourneyStatuses<T extends StatusInput>(
  tasks: T[]
): Map<string, Task["status"]> {
  const ordered = orderTasks(tasks);
  const result = new Map<string, Task["status"]>();

  for (const task of ordered) {
    let next: Task["status"];
    if (task.status === "approved") {
      next = "approved";
    } else if (task.hasPendingProof) {
      next = "proof_submitted";
    } else {
      next = "active"; // every unfinished task is open — nothing blocks
    }
    result.set(task.id, next);
  }
  return result;
}

/** True when any stored status disagrees with the rules above. */
export function needsRecalc<T extends StatusInput>(tasks: T[]): boolean {
  const expected = computeJourneyStatuses(tasks);
  return tasks.some((t) => expected.get(t.id) !== t.status);
}

/**
 * Recompute and PERSIST the whole journey for the student who owns
 * `appointmentId`, then issue certificates for any fully-approved session.
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

  const finalStatus = computeJourneyStatuses(
    tasks.map((t) => ({
      ...t,
      hasPendingProof: t.proof_submissions?.some((p) => p.status === "pending"),
    }))
  );

  for (const task of tasks) {
    const next = finalStatus.get(task.id);
    if (next && next !== task.status) {
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
