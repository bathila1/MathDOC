import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getDownloadUrl } from "@/lib/server/files";
import type { McqAttempt } from "@/lib/shared/types";

export interface ExamQuestionForStudent {
  id: string;
  kind: "mcq" | "text";
  text: string;
  options: string[];
  /** Presigned URL for the question picture, if the teacher attached one. */
  imageUrl: string | null;
}

/**
 * Questions for the student exam — served via the service role with
 * correct_index STRIPPED (students have no direct read access to the table).
 * Question images are presigned here for the same reason.
 */
export async function getExamQuestions(): Promise<ExamQuestionForStudent[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("mcq_questions")
    .select("id, text, options, kind, image_key")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    text: string;
    options: string[] | null;
    kind: "mcq" | "text" | null;
    image_key: string | null;
  }[];

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      kind: r.kind ?? "mcq",
      text: r.text,
      options: r.options ?? [],
      imageUrl: r.image_key ? await getDownloadUrl(r.image_key) : null,
    }))
  );
}

export async function getAttemptForStudent(
  studentId: string
): Promise<McqAttempt | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("mcq_attempts")
    .select("*")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as McqAttempt) ?? null;
}
