"use server";

import { z } from "zod";
import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getAuth, requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { notifyAdmins } from "@/features/notifications/server/notify";
import {
  profileSchema,
  categorySchema,
  studentNoteSchema,
} from "@/lib/shared/schemas";
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
): Promise<ActionResult<{ next: string }>> {
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

  // Tell the teacher — but only the first time they complete registration,
  // not on every later profile edit.
  if (!auth.profile.profile_completed) {
    await notifyAdmins({
      type: "registration",
      title: "New student registered",
      body: parsed.data.full_name ?? null,
      link: `/admin/students/${auth.user.id}`,
    });
  }

  revalidatePath("/student");
  revalidatePath("/student/profile");
  // Registration is the last step — straight to the dashboard. (The survey is
  // asked later, at booking time, so it can be re-answered each session.)
  return ok({ next: "/student" });
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

/** Teacher adds a private note about a student (admin-only, never shown to them). */
export async function addStudentNote(
  input: unknown
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = studentNoteSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("student_teacher_notes").insert({
    student_id: parsed.data.student_id,
    body: parsed.data.body,
  });
  if (error) {
    console.error("addStudentNote failed:", error.message);
    return fail("Couldn't save the note. Please try again.");
  }
  revalidatePath(`/admin/students/${parsed.data.student_id}`);
  return ok(undefined);
}

/** Remove one of the teacher's private notes. */
export async function deleteStudentNote(
  id: string
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return fail("Unknown note.");

  const supabase = await createSupabaseServer();
  const { data: note } = await supabase
    .from("student_teacher_notes")
    .select("student_id")
    .eq("id", parsed.data)
    .maybeSingle();
  const { error } = await supabase
    .from("student_teacher_notes")
    .delete()
    .eq("id", parsed.data);
  if (error) {
    console.error("deleteStudentNote failed:", error.message);
    return fail("Couldn't delete the note.");
  }
  if (note) revalidatePath(`/admin/students/${note.student_id}`);
  return ok(undefined);
}
