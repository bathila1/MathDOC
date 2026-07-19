import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — BYPASSES RLS. Only for trusted server code paths:
 * MCQ grading, invoice/certificate lookup by token, task-state recalcs,
 * R2 key ownership checks. Never expose results without an ownership check.
 */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
