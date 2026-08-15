"use server";

import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getAuth } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { mcqSubmitSchema } from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { revalidatePath } from "next/cache";

/**
 * Grade the placement exam SERVER-SIDE (correct answers never reach the
 * browser) and store the attempt + score on the student's profile.
 */
export async function submitExam(
  input: unknown
): Promise<ActionResult<{ score: number; total: number }>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");
  if (auth.profile.role !== "student") return fail("Only students sit the exam.");

  const rl = await rateLimit("form", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = mcqSubmitSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("mcq_attempts")
    .select("id")
    .eq("student_id", auth.user.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return fail("You've already completed the placement quiz.");
  }

  const { data: questions, error: qErr } = await admin
    .from("mcq_questions")
    .select("id, correct_index, kind")
    .eq("is_active", true);
  if (qErr || !questions?.length) {
    return fail("The quiz isn't available right now. Please try again later.");
  }

  const answers = parsed.data.answers;
  let score = 0;
  let total = 0;
  for (const q of questions as { id: string; correct_index: number | null; kind: string }[]) {
    // Typed answers can't be machine-marked — Sir reads them on the student's
    // page. They're stored but excluded from the score AND the total, so a
    // student isn't penalised for a question that was never auto-gradable.
    if (q.kind === "text") continue;
    total++;
    if (answers[q.id] === q.correct_index) score++;
  }

  const { error: aErr } = await admin.from("mcq_attempts").insert({
    student_id: auth.user.id,
    answers,
    score,
    total,
  });
  if (aErr) {
    console.error("submitExam insert failed:", aErr.message);
    return fail("We couldn't save your answers. Please try again.");
  }

  await admin
    .from("profiles")
    .update({ mcq_score: score, mcq_total: total })
    .eq("id", auth.user.id);

  revalidatePath("/student");
  return ok({ score, total });
}
