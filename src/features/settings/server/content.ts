import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getDownloadUrl } from "@/lib/server/files";
import {
  SITE_CONTENT_KEYS,
  SITE_CONTENT_DEFAULTS,
  type SiteContent,
} from "@/lib/shared/site-content";

/**
 * Load all editable landing-page content in ONE query rather than a getSetting()
 * round-trip per field — this runs on the public home page, so it is on the
 * critical path for every first-time visitor.
 */
export async function getSiteContent(): Promise<SiteContent> {
  const admin = createSupabaseAdmin();
  const keys = Object.values(SITE_CONTENT_KEYS);
  const { data } = await admin
    .from("settings")
    .select("key, value")
    .in("key", keys);

  const byKey = new Map(
    ((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value])
  );
  const pick = (k: string): string | null => {
    const v = byKey.get(k);
    return v && v.trim() ? v.trim() : null;
  };

  return {
    heroHeading: pick(SITE_CONTENT_KEYS.heroHeading) ?? SITE_CONTENT_DEFAULTS.heroHeading,
    heroImageKey: pick(SITE_CONTENT_KEYS.heroImageKey),
    facebookUrl: pick(SITE_CONTENT_KEYS.facebookUrl),
    youtubeUrl: pick(SITE_CONTENT_KEYS.youtubeUrl),
    whatsappUrl: pick(SITE_CONTENT_KEYS.whatsappUrl),
    telegramUrl: pick(SITE_CONTENT_KEYS.telegramUrl),
  };
}

/** Presigned URL for the custom hero photo, or null to use the /sir.jpg fallback. */
export async function getHeroImageUrl(
  content: SiteContent
): Promise<string | null> {
  if (!content.heroImageKey) return null;
  try {
    return await getDownloadUrl(content.heroImageKey);
  } catch {
    return null; // a stale key must not break the landing page
  }
}
