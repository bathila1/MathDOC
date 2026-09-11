import { withAdmin } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { getDownloadUrl } from "@/lib/server/files";
import {
  Pagination,
  PAGE_SIZE,
  pageFrom,
  rangeFor,
} from "@/components/site/Pagination";
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
  student_id: string;
  time_spent_seconds: number | null;
  tasks: {
    title: string;
    appointment_id: string;
  } | null;
  profiles: { full_name: string | null } | null;
}

export default async function ProofsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = pageFrom((await searchParams).page);
  const [from, to] = rangeFor(page);

  const supabase = await createSupabaseServer();
  // withAdmin runs the guard and these queries together instead of one after
  // the other — see lib/server/auth.ts. Everything below is RLS-scoped.
  const { data, count } = await withAdmin(() =>
    supabase
      .from("proof_submissions")
      .select(
        "id, submitted_at, student_note, file_keys, student_id, time_spent_seconds, tasks(title, appointment_id), profiles(full_name)",
        { count: "exact" }
      )
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .range(from, to)
  );

  const rows = (data ?? []) as unknown as ProofRow[];

  const proofs: ProofForReview[] = await Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      submitted_at: p.submitted_at,
      student_note: p.student_note,
      student_name: p.profiles?.full_name ?? "Student",
      studentHref: `/admin/students/${p.student_id}`,
      task_title: p.tasks?.title ?? "Task",
      timeSpentSeconds: p.time_spent_seconds,
      sessionHref: p.tasks?.appointment_id
        ? `/admin/appointments/${p.tasks.appointment_id}`
        : null,
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
          Nothing waiting for review.
        </p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {proofs.map((p) => (
              <ProofReviewCard key={p.id} proof={p} />
            ))}
          </div>
          <Pagination
            page={page}
            total={count ?? proofs.length}
            basePath="/admin/proofs"
            size={PAGE_SIZE}
          />
        </>
      )}
    </div>
  );
}
