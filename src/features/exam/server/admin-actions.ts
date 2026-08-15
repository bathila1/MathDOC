"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { keyBelongsTo } from "@/lib/server/keys";
import { mcqQuestionSchema } from "@/lib/shared/schemas";
import { z } from "zod";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { revalidatePath } from "next/cache";

// Admin CRUD for placement-exam questions. Runs as the admin user through
// RLS ("mcq_questions: admin all" policy).

async function guard(): Promise<string | null> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  return rl.allowed ? null : rl.message!;
}

/**
 * A question picture arrives as a key the client got from our presign
 * endpoint — confirm it was issued to this admin before storing it.
 */
async function checkImageKey(
  key: string | null | undefined
): Promise<ActionResult<undefined> | null> {
  if (!key) return null;
  const { user } = await requireAdmin();
  return keyBelongsTo(key, user.id)
    ? null
    : fail("That picture couldn't be attached. Please upload it again.");
}

export async function createQuestion(
  input: unknown
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const parsed = mcqQuestionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const keyError = await checkImageKey(parsed.data.image_key);
  if (keyError) return keyError;

  const supabase = await createSupabaseServer();
  const { data: last } = await supabase
    .from("mcq_questions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("mcq_questions").insert({
    ...parsed.data,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return fail("Couldn't add the question. Please try again.");

  revalidatePath("/admin/exam");
  return ok(undefined);
}

export async function updateQuestion(
  questionId: string,
  input: unknown
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");
  const parsed = mcqQuestionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const keyError = await checkImageKey(parsed.data.image_key);
  if (keyError) return keyError;

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("mcq_questions")
    .update(parsed.data)
    .eq("id", id.data);
  if (error) return fail("Couldn't update the question. Please try again.");

  revalidatePath("/admin/exam");
  return ok(undefined);
}

export async function deleteQuestion(
  questionId: string
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("mcq_questions")
    .delete()
    .eq("id", id.data);
  if (error) return fail("Couldn't delete the question.");

  revalidatePath("/admin/exam");
  return ok(undefined);
}

export async function toggleQuestionActive(
  questionId: string,
  isActive: boolean
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("mcq_questions")
    .update({ is_active: isActive })
    .eq("id", id.data);
  if (error) return fail("Couldn't update the question.");

  revalidatePath("/admin/exam");
  return ok(undefined);
}

/** Swap sort_order with the neighbour above/below. */
export async function moveQuestion(
  questionId: string,
  direction: "up" | "down"
): Promise<ActionResult<undefined>> {
  const blocked = await guard();
  if (blocked) return fail(blocked);

  const id = z.string().uuid().safeParse(questionId);
  if (!id.success) return fail("Unknown question.");

  const supabase = await createSupabaseServer();
  const { data: current } = await supabase
    .from("mcq_questions")
    .select("id, sort_order")
    .eq("id", id.data)
    .single();
  if (!current) return fail("Unknown question.");

  const { data: neighbour } = await supabase
    .from("mcq_questions")
    .select("id, sort_order")
    .order("sort_order", { ascending: direction === "down" })
    [direction === "down" ? "gt" : "lt"]("sort_order", current.sort_order)
    .limit(1)
    .maybeSingle();
  if (!neighbour) return ok(undefined); // already first/last

  await supabase
    .from("mcq_questions")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", current.id);
  await supabase
    .from("mcq_questions")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbour.id);

  revalidatePath("/admin/exam");
  return ok(undefined);
}
