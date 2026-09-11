"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/ratelimit";
import { newStudentSchema } from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";

/**
 * Add a student by hand, for someone who enrolled in person.
 *
 * Creates the Supabase auth user with the email already confirmed and an
 * initial password the teacher hands over face to face. Confirming it here is
 * the point: it means adding a student needs no working outbound email at all,
 * so this path keeps functioning even when nothing else can reach an inbox.
 * The student changes the password from their profile page afterwards.
 *
 * The `on_auth_user_created` trigger creates the matching profile row; we then
 * fill in the name.
 *
 * `profile_completed` is deliberately left false: phone, school, grade and
 * guardian details are still missing, so the student is sent to /register on
 * first login to finish their own record rather than the teacher guessing.
 */
export async function createStudent(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = newStudentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { full_name, email, password } = parsed.data;

  const admin = createSupabaseAdmin();

  // profiles.email is uniquely indexed on lower(email); the schema already
  // lowercased it. Checking first turns a raw 23505 into a message that names
  // who holds the address.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return fail(
      `That email already belongs to ${
        (existing as { full_name: string | null }).full_name ?? "another student"
      }.`,
      { email: "This email is already registered." }
    );
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !created.user) {
    console.error("createStudent auth failed:", error?.message);
    return fail(
      error?.message?.includes("already")
        ? "That email already has an account."
        : "Couldn't create the student. Please try again.",
      error?.message?.includes("already")
        ? { email: "This email is already registered." }
        : undefined
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name, role: "student" })
    .eq("id", created.user.id);

  if (profileError) {
    // Don't leave a half-made account behind.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("createStudent profile failed:", profileError.message);
    return fail("Couldn't save the student's details. Please try again.");
  }

  revalidatePath("/admin/students");
  return ok({ id: created.user.id });
}

/**
 * Permanently delete a student and everything belonging to them.
 *
 * Deletes the AUTH user, not just the profile row. Removing only the profile
 * would leave the login intact — the student could sign in again and the
 * new-user trigger would hand them a fresh, empty profile. Deleting the auth
 * user cascades through profiles and from there to tasks, appointments,
 * invoices, proofs, notes and certificates.
 */
export async function deleteStudent(
  studentId: string
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const id = z.string().uuid().safeParse(studentId);
  if (!id.success) return fail("Unknown student.");

  const admin = createSupabaseAdmin();

  // Confirm the target really is a student. Without this an admin id passed to
  // this action would delete the teacher's own account.
  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", id.data)
    .maybeSingle();
  if (!target) return fail("We couldn't find that student.");
  if ((target as { role: string }).role !== "student") {
    return fail("Only student accounts can be deleted here.");
  }

  const { error } = await admin.auth.admin.deleteUser(id.data);
  if (error) {
    console.error("deleteStudent failed:", error.message);
    return fail("Couldn't delete the student. Please try again.");
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin");
  return ok(undefined);
}
