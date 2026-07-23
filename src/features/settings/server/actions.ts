"use server";

import { requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { setSetting } from "@/lib/server/settings";
import { ok, fail, type ActionResult } from "@/lib/shared/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Turn the pricing/payment step on or off for new bookings. */
export async function setPaymentsEnabled(
  enabled: unknown
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return fail("Invalid value.");

  await setSetting("payments_enabled", parsed.data ? "true" : "false");
  revalidatePath("/admin/settings");
  return ok(undefined);
}
