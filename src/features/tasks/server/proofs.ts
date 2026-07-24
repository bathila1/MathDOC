import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDownloadUrl } from "@/lib/server/files";
import type { AdminProof } from "@/features/tasks/client/TaskManager";

interface ProofRow {
  id: string;
  status: AdminProof["status"];
  submitted_at: string;
  student_note: string | null;
  time_spent_seconds: number | null;
  file_keys: string[];
  task_id: string;
}

/**
 * Load every submission for the given tasks and resolve their file keys to
 * viewable (presigned) URLs, grouped by task_id and newest-first.
 */
export async function loadProofsByTask(
  supabase: SupabaseClient,
  taskIds: string[]
): Promise<Map<string, AdminProof[]>> {
  const map = new Map<string, AdminProof[]>();
  if (taskIds.length === 0) return map;

  const { data } = await supabase
    .from("proof_submissions")
    .select(
      "id, status, submitted_at, student_note, time_spent_seconds, file_keys, task_id"
    )
    .in("task_id", taskIds)
    .order("submitted_at", { ascending: false });

  for (const p of (data ?? []) as ProofRow[]) {
    const files = await Promise.all(
      (p.file_keys ?? []).map(async (key, i) => ({
        name: `File ${i + 1}`,
        url: await getDownloadUrl(key),
      }))
    );
    const arr = map.get(p.task_id) ?? [];
    arr.push({
      id: p.id,
      status: p.status,
      submittedAt: p.submitted_at,
      studentNote: p.student_note,
      timeSpentSeconds: p.time_spent_seconds,
      files,
    });
    map.set(p.task_id, arr);
  }
  return map;
}
