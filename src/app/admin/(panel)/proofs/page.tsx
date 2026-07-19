import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getDownloadUrl } from "@/lib/server/files";
import {
  ProofReviewCard,
  type ProofForReview,
} from "@/features/tasks/client/ProofReviewCard";

export const metadata = { title: "Proof reviews" };

interface ProofRow {
  id: string;
  submitted_at: string;
  student_note: string | null;
  file_keys: string[];
  tasks: { title: string } | null;
  profiles: { full_name: string | null } | null;
}

export default async function ProofsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("proof_submissions")
    .select(
      "id, submitted_at, student_note, file_keys, tasks(title), profiles(full_name)"
    )
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  const rows = (data ?? []) as unknown as ProofRow[];

  const proofs: ProofForReview[] = await Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      submitted_at: p.submitted_at,
      student_note: p.student_note,
      student_name: p.profiles?.full_name ?? "Student",
      task_title: p.tasks?.title ?? "Task",
      files: await Promise.all(
        (p.file_keys ?? []).map(async (key, i) => ({
          name: `File ${i + 1}`,
          url: await getDownloadUrl(key),
        }))
      ),
    }))
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Proof reviews</h1>
      {proofs.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nothing waiting for review. 🎉
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {proofs.map((p) => (
            <ProofReviewCard key={p.id} proof={p} />
          ))}
        </div>
      )}
    </div>
  );
}
