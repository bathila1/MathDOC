"use server";

import { getAuth } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { ok, fail, type ActionResult } from "@/lib/shared/action-result";
import { z } from "zod";

const subSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

/** Store this browser's Web Push subscription for the logged-in user. */
export async function savePushSubscription(
  input: unknown
): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");

  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid subscription.");

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    console.error("savePushSubscription failed:", error.message);
    return fail("Couldn't save the subscription.");
  }
  return ok(undefined);
}
