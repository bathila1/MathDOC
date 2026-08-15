"use server";

import { requireAdmin } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { setSetting } from "@/lib/server/settings";
import { ADMIN_NOTIFY_TYPES, adminNotifyKey } from "@/lib/shared/notifications";
import { SITE_CONTENT_KEYS } from "@/lib/shared/site-content";
import { httpUrlField } from "@/lib/shared/schemas";
import { keyBelongsTo } from "@/lib/server/keys";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
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

/** Enable/disable one category of admin notification (control centre). */
export async function setAdminNotifyPref(
  input: unknown
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = z
    .object({ type: z.string(), enabled: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return fail("Invalid value.");
  if (!ADMIN_NOTIFY_TYPES.some((t) => t.key === parsed.data.type)) {
    return fail("Unknown notification type.");
  }

  await setSetting(
    adminNotifyKey(parsed.data.type),
    parsed.data.enabled ? "true" : "false"
  );
  revalidatePath("/admin/settings");
  return ok(undefined);
}

/**
 * Landing-page content: hero heading, hero photo, and the footer social links.
 * Social URLs are rendered as anchors, so they go through httpUrlField — a
 * `javascript:` URL here would be stored XSS on the public home page.
 */
const siteContentSchema = z.object({
  heroHeading: z
    .string()
    .trim()
    .min(1, "The heading can't be empty.")
    .max(160, "That heading is too long."),
  heroImageKey: z.string().max(500).optional().nullable(),
  facebookUrl: httpUrlField(500, "Facebook URL"),
  youtubeUrl: httpUrlField(500, "YouTube URL"),
  whatsappUrl: httpUrlField(500, "WhatsApp URL"),
  telegramUrl: httpUrlField(500, "Telegram URL"),
});

export async function saveSiteContent(
  input: unknown
): Promise<ActionResult<undefined>> {
  const { user } = await requireAdmin();
  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = siteContentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const key = parsed.data.heroImageKey?.trim() || null;
  if (key && !keyBelongsTo(key, user.id)) {
    return fail("That image couldn't be attached. Please upload it again.");
  }

  await Promise.all([
    setSetting(SITE_CONTENT_KEYS.heroHeading, parsed.data.heroHeading),
    setSetting(SITE_CONTENT_KEYS.heroImageKey, key ?? ""),
    setSetting(SITE_CONTENT_KEYS.facebookUrl, parsed.data.facebookUrl ?? ""),
    setSetting(SITE_CONTENT_KEYS.youtubeUrl, parsed.data.youtubeUrl ?? ""),
    setSetting(SITE_CONTENT_KEYS.whatsappUrl, parsed.data.whatsappUrl ?? ""),
    setSetting(SITE_CONTENT_KEYS.telegramUrl, parsed.data.telegramUrl ?? ""),
  ]);

  revalidatePath("/admin/settings");
  revalidatePath("/"); // the public landing page renders this content
  return ok(undefined);
}
