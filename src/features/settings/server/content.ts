import "server-only";
import { getSettings } from "@/lib/server/settings";
import { getDownloadUrl } from "@/lib/server/files";
import {
  SITE_CONTENT_KEYS,
  SITE_CONTENT_DEFAULTS,
  type SiteContent,
} from "@/lib/shared/site-content";

/**
 * Load all editable landing-page content without a round-trip of its own.
 *
 * This runs on the public home page, so it is on the critical path for every
 * first-time visitor. It used to be one query here; now it reads from the
 * request-wide settings snapshot (lib/server/settings.ts), so a page that also
 * needs, say, the payments flag pays for one query between them rather than two.
 */
export async function getSiteContent(): Promise<SiteContent> {
  const byKey = await getSettings(Object.values(SITE_CONTENT_KEYS));

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
