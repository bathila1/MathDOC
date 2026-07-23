import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

/**
 * Record a successful student login: bump profiles.last_login_at and append a
 * login_activity row. Best-effort — never blocks or fails the login itself.
 */
export async function recordStudentLogin(userId: string): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    await admin
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("role", "student");
    await admin.from("login_activity").insert({ student_id: userId });
  } catch (e) {
    console.error("recordStudentLogin failed:", e);
  }
}
