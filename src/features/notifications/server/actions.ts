"use server";

import { getAuth } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/ratelimit";
import { ok, fail, type ActionResult } from "@/lib/shared/action-result";
import { isSafeExternalUrl } from "@/lib/shared/url";
import { z } from "zod";

const subSchema = z.object({
  // This URL is stored and later POSTed to BY THE SERVER, so a permissive
  // check here is a blind SSRF sink: `z.string().url()` accepted any scheme and
  // any host, letting a logged-in user point our sender at internal addresses.
  // Real push endpoints are always https (FCM, Mozilla, WNS), so require that
  // — it rules out plain-http internal targets such as cloud metadata services.
  // Length-bounded because these are stored and iterated on every send.
  endpoint: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (v) => isSafeExternalUrl(v) && v.toLowerCase().startsWith("https://"),
      "Invalid push endpoint."
    ),
  p256dh: z.string().trim().min(1).max(255),
  auth: z.string().trim().min(1).max(255),
});

/** Store this browser's Web Push subscription for the logged-in user. */
export async function savePushSubscription(
  input: unknown
): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");

  // Each browser registers once and re-registers only when the VAPID key
  // rotates, so a burst means a loop or an abusive client.
  const rl = await rateLimit("push", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

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
