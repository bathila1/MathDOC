"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/ratelimit";
import { clearDataSchema } from "@/lib/shared/schemas";
import type { ClearScope } from "@/lib/shared/data-scopes";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";

/**
 * Selective data wipe, driven from Settings → Clear data.
 *
 * Guardrails, in order of how much they matter:
 *   - requireAdmin() plus a typed confirmation word (see clearDataSchema).
 *   - Only the tables named below are reachable. Configuration — settings,
 *     survey_questions, default_tasks — is never touched, so clearing leaves an
 *     empty site rather than a broken one.
 *   - The teacher's own account is excluded by `role = 'student'` on every
 *     account-level delete.
 *
 * NOTE ON FILES: uploaded objects in R2 are NOT removed. Deleting the database
 * rows removes every reference to them, so they become unreachable through the
 * app, but they still occupy the bucket. Clearing those is a separate job
 * against Cloudflare (see docs/deployment.md).
 */
export async function clearData(
  input: unknown
): Promise<ActionResult<{ cleared: string[]; studentsDeleted: number }>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = clearDataSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const scopes = new Set<ClearScope>(parsed.data.scopes);

  const admin = createSupabaseAdmin();
  const cleared: string[] = [];
  let studentsDeleted = 0;

  /**
   * Delete every row of a table.
   *
   * PostgREST refuses an unfiltered DELETE, so a match-everything filter is
   * required. `not(<pk>, "is", null)` is used rather than comparing against an
   * impossible id because it works whatever the key is called and whatever its
   * type — `task_sir_notes` is keyed by `task_id` and has no `id` column at
   * all, which an id-based filter silently turned into a failed request.
   */
  const wipe = async (table: string, primaryKey = "id") => {
    const { error } = await admin
      .from(table)
      .delete()
      .not(primaryKey, "is", null);
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  try {
    // Order matters where a table has no cascade from the one before it.
    // Children first, so nothing is left pointing at a deleted parent.

    if (scopes.has("tasks")) {
      await wipe("task_messages");
      await wipe("task_sir_notes", "task_id"); // keyed by task_id, no id column
      await wipe("proof_submissions");
      await wipe("tasks");
      cleared.push("Tasks & proofs");
    }

    if (scopes.has("certificates")) {
      await wipe("certificates");
      cleared.push("Certificates");
    }

    if (scopes.has("survey")) {
      await wipe("survey_responses");
      cleared.push("Survey answers");
    }

    if (scopes.has("notes")) {
      await wipe("session_notes");
      await wipe("student_teacher_notes");
      cleared.push("Session & private notes");
    }

    if (scopes.has("notifications")) {
      await wipe("notifications");
      await wipe("push_subscriptions");
      cleared.push("Notifications");
    }

    if (scopes.has("activity")) {
      await wipe("login_activity");
      cleared.push("Login history");
    }

    if (scopes.has("appointments")) {
      // Invoices cascade from appointments, but tasks reference appointments
      // too — clear tasks first if both were asked for (handled above).
      await wipe("invoices");
      await wipe("appointments");
      // Bookings are gone, so the times they held are free again.
      const { error } = await admin
        .from("availability_slots")
        .update({ status: "free" })
        .eq("status", "booked");
      if (error) throw new Error(`availability_slots: ${error.message}`);
      cleared.push("Appointments & invoices");
    }

    if (scopes.has("slots")) {
      // Booked times are kept: deleting one would strand a real session.
      const { error } = await admin
        .from("availability_slots")
        .delete()
        .eq("status", "free");
      if (error) throw new Error(`availability_slots: ${error.message}`);
      cleared.push("Availability times");
    }

    if (scopes.has("students")) {
      const { data: students, error } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "student"); // never the teacher
      if (error) throw new Error(`profiles: ${error.message}`);

      // Delete the AUTH user, not the profile row: removing only the profile
      // leaves a working login that would be handed a fresh empty profile on
      // next sign-in. Everything else cascades from auth.users.
      for (const s of (students ?? []) as { id: string }[]) {
        const { error: delErr } = await admin.auth.admin.deleteUser(s.id);
        if (delErr) {
          console.error("clearData: deleteUser", s.id, delErr.message);
          continue; // keep going; report the true count below
        }
        studentsDeleted++;
      }
      cleared.push(`Student accounts (${studentsDeleted})`);
    }
  } catch (err) {
    console.error("clearData failed:", err);
    return fail(
      err instanceof Error
        ? `Stopped part-way: ${err.message}. Nothing further was deleted.`
        : "Couldn't clear that data."
    );
  }

  // Everything the admin panel and student area might show.
  for (const path of [
    "/admin",
    "/admin/students",
    "/admin/appointments",
    "/admin/availability",
    "/admin/proofs",
    "/admin/activity",
    "/admin/settings",
    "/student",
  ]) {
    revalidatePath(path);
  }

  return ok({ cleared, studentsDeleted });
}
