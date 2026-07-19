"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getAuth, requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { profileSchema, categorySchema } from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { revalidatePath } from "next/cache";

/**
 * Save the student's registration profile. Uses the service role because
 * students have no direct write access to `profiles` (protects role/category
 * columns) — the row is strictly scoped to the logged-in user's id.
 */
export async function saveProfile(
  input: unknown
): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");
  if (auth.profile.role !== "student") return fail("Only students can register.");

  const rl = await rateLimit("form", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ ...parsed.data, profile_completed: true })
    .eq("id", auth.user.id);

  if (error) {
    console.error("saveProfile failed:", error.message);
    return fail("We couldn't save your details. Please try again.");
  }
  revalidatePath("/student");
  return ok(undefined);
}

/** Teacher assigns a knowledge category to a student. */
export async function assignCategory(
  input: unknown
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({ category: parsed.data.category })
    .eq("id", parsed.data.student_id);

  if (error) {
    console.error("assignCategory failed:", error.message);
    return fail("Couldn't update the category. Please try again.");
  }
  revalidatePath(`/admin/students/${parsed.data.student_id}`);
  revalidatePath("/admin/students");
  return ok(undefined);
}
