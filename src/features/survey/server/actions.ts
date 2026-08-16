"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/lib/server/auth";
import { createSupabaseServer } from "@/lib/server/supabase";
import { rateLimit } from "@/lib/server/ratelimit";
import {
  surveyQuestionSchema,
  surveySubmitSchema,
} from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { getActiveSurveyQuestions } from "./queries";

/**
 * Record a student's survey answers.
 *
 * Every submission inserts a NEW row rather than updating the last one — the
 * change between submissions is the point of the survey.
 */
export async function submitSurvey(
  input: unknown
): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");
  if (auth.profile.role !== "student") {
    return fail("Only students answer the survey.");
  }

  const rl = await rateLimit("form", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = surveySubmitSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  // Shape was checked by zod; MEANING can only be checked against the current
  // questions, so it happens here and not in the browser.
  const questions = await getActiveSurveyQuestions();
  if (questions.length === 0) {
    return fail("There are no survey questions to answer right now.");
  }

  const clean: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};

  for (const q of questions) {
    const raw = (parsed.data.answers[q.id] ?? "").trim();

    if (!raw) {
      if (q.is_required) fieldErrors[q.id] = "Please answer this question.";
      continue;
    }

    if (q.kind === "choice" && !q.options.includes(raw)) {
      // Rejects a hand-crafted POST carrying an option that isn't offered.
      fieldErrors[q.id] = "Please pick one of the given answers.";
      continue;
    }

    if (q.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        fieldErrors[q.id] = "Please enter a number.";
        continue;
      }
      // Normalise so "7", "7.0" and " 7 " compare equal across submissions.
      clean[q.id] = String(n);
      continue;
    }

    clean[q.id] = raw;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("Please check your answers.", fieldErrors);
  }

  // Answers for questions that are no longer active are dropped by the loop
  // above — only keys we just built get stored, so extra keys in the request
  // body cannot smuggle anything in.
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("survey_responses").insert({
    student_id: auth.user.id,
    answers: clean,
  });

  if (error) {
    console.error("submitSurvey failed:", error.code, error.message);
    if (error.code === "PGRST205" || error.message.includes("schema cache")) {
      return fail(
        "The survey tables are missing from the database. Apply " +
          "supabase/migrations/021_survey_replaces_placement_test.sql."
      );
    }
    return fail("Couldn't save your answers. Please try again.");
  }

  revalidatePath("/student/book");
  revalidatePath(`/admin/students/${auth.user.id}`);
  return ok(undefined);
}

// ---------- admin: manage the questions ----------

async function guard(): Promise<string | null> {
  const auth = await getAuth();
  if (!auth || auth.profile.role !== "admin") return "Not allowed.";
  const rl = await rateLimit("form", `user:${auth.user.id}`);
  return rl.allowed ? null : rl.message!;
}

function revalidateSurvey() {
  revalidatePath("/admin/survey");
  revalidatePath("/student/book");
}

export async function createSurveyQuestion(
  input: unknown
): Promise<ActionResult<undefined>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const parsed = surveyQuestionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  // Append to the end of the list.
  const { data: last } = await supabase
    .from("survey_questions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("survey_questions").insert({
    ...parsed.data,
    sort_order: ((last?.sort_order as number | undefined) ?? 0) + 1,
  });
  if (error) {
    console.error("createSurveyQuestion failed:", error.message);
    return fail("Couldn't add the question.");
  }
  revalidateSurvey();
  return ok(undefined);
}

export async function updateSurveyQuestion(
  questionId: string,
  input: unknown
): Promise<ActionResult<undefined>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");

  const parsed = surveyQuestionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("survey_questions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return fail("Couldn't save the question.");
  revalidateSurvey();
  return ok(undefined);
}

export async function deleteSurveyQuestion(
  questionId: string
): Promise<ActionResult<undefined>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("survey_questions")
    .delete()
    .eq("id", id.data);
  if (error) return fail("Couldn't delete the question.");
  revalidateSurvey();
  return ok(undefined);
}

export async function toggleSurveyQuestionActive(
  questionId: string,
  isActive: boolean
): Promise<ActionResult<undefined>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("survey_questions")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return fail("Couldn't update the question.");
  revalidateSurvey();
  return ok(undefined);
}

/** Move a question one place up or down in the list. */
export async function moveSurveyQuestion(
  questionId: string,
  direction: "up" | "down"
): Promise<ActionResult<undefined>> {
  const denied = await guard();
  if (denied) return fail(denied);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");

  const supabase = await createSupabaseServer();
  const { data: rows } = await supabase
    .from("survey_questions")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });

  const list = (rows ?? []) as { id: string; sort_order: number }[];
  const i = list.findIndex((q) => q.id === id.data);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return ok(undefined); // already at the end

  // Swap the two sort_order values.
  await Promise.all([
    supabase
      .from("survey_questions")
      .update({ sort_order: list[j].sort_order })
      .eq("id", list[i].id),
    supabase
      .from("survey_questions")
      .update({ sort_order: list[i].sort_order })
      .eq("id", list[j].id),
  ]);

  revalidateSurvey();
  return ok(undefined);
}
