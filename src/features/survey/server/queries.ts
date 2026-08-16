import "server-only";
import { createSupabaseServer } from "@/lib/server/supabase";
import type { SurveyQuestion, SurveyResponse } from "@/lib/shared/types";

/** Active questions, in the order Sir arranged them. */
export async function getActiveSurveyQuestions(): Promise<SurveyQuestion[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("survey_questions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as SurveyQuestion[];
}

/** Every question including retired ones — for the admin editor. */
export async function getAllSurveyQuestions(): Promise<SurveyQuestion[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("survey_questions")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as SurveyQuestion[];
}

/**
 * The student's most recent answers, used to pre-fill the dialog so they edit
 * last time's answers rather than starting from scratch.
 */
export async function getLatestSurveyResponse(
  studentId: string
): Promise<SurveyResponse | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SurveyResponse) ?? null;
}

/**
 * Full submission history, newest first. This is what makes the survey worth
 * re-asking: Sir compares "hours studied" across sessions to see whether the
 * student is actually picking up.
 */
export async function getSurveyHistory(
  studentId: string
): Promise<SurveyResponse[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });
  return (data ?? []) as SurveyResponse[];
}

/**
 * Whether the student may proceed to booking.
 *
 * True when they have submitted the survey at least once, or when Sir has no
 * required questions active (nothing to answer means nothing to block on).
 */
export async function hasAnsweredSurvey(studentId: string): Promise<boolean> {
  const supabase = await createSupabaseServer();
  const [{ count: required }, { count: responses }] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_required", true),
    supabase
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId),
  ]);
  if ((required ?? 0) === 0) return true;
  return (responses ?? 0) > 0;
}
