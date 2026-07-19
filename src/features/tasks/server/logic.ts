import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { issueCertificateIfComplete } from "@/features/certificates/server/issue";
import type { Task } from "@/lib/shared/types";

/**
 * The task-game rule, applied after every change:
 * tasks run strictly in order — everything before the first unfinished task
 * is approved; that first unfinished task is `active` (or `proof_submitted`
 * while a proof awaits review); everything after it stays `locked`.
 */
export async function recalcTaskStatuses(appointmentId: string): Promise<void> {
  const admin = createSupabaseAdmin();

  const { data } = await admin
    .from("tasks")
    .select("*, proof_submissions(id, status)")
    .eq("appointment_id", appointmentId)
    .order("sort_order", { ascending: true });

  const tasks = (data ?? []) as (Task & {
    proof_submissions: { id: string; status: string }[];
  })[];
  if (tasks.length === 0) return;

  let unlocked = true; // first non-approved task becomes active
  for (const task of tasks) {
    let next: Task["status"];
    if (task.status === "approved") {
      next = "approved";
    } else if (unlocked) {
      const hasPendingProof = task.proof_submissions?.some(
        (p) => p.status === "pending"
      );
      next = hasPendingProof ? "proof_submitted" : "active";
      unlocked = false;
    } else {
      next = "locked";
    }
    if (next !== task.status) {
      await admin.from("tasks").update({ status: next }).eq("id", task.id);
    }
  }

  const allApproved = tasks.every((t) => t.status === "approved");
  if (allApproved) {
    await issueCertificateIfComplete(appointmentId);
  }
}
