import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import type { McqAttempt } from "@/lib/shared/types";

export interface ExamQuestionForStudent {
  id: string;
  text: string;
  options: string[];
}

/**
 * Questions for the student exam — served via the service role with
 * correct_index STRIPPED (students have no direct read access to the table).
 */
export async function getExamQuestions(): Promise<ExamQuestionForStudent[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("mcq_questions")
    .select("id, text, options")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExamQuestionForStudent[];
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
