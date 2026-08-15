/**
 * Editable landing-page content, stored as rows in the key/value `settings`
 * table — so no migration is needed to change any of it.
 *
 * Read on the server with getSiteContent() (features/settings/server/content.ts)
 * and written from admin Settings → Site content.
 */

export interface SiteContent {
  heroHeading: string;
  /** R2 object key for the hero photo; null falls back to /sir.jpg. */
  heroImageKey: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

/** settings.key for each field. */
export const SITE_CONTENT_KEYS = {
  heroHeading: "site_hero_heading",
  heroImageKey: "site_hero_image_key",
  facebookUrl: "social_facebook_url",
  youtubeUrl: "social_youtube_url",
  whatsappUrl: "social_whatsapp_url",
  telegramUrl: "social_telegram_url",
} as const satisfies Record<keyof SiteContent, string>;

export const DEFAULT_HERO_HEADING =
  "Every student deserves a plan of their own.";

export const SITE_CONTENT_DEFAULTS: SiteContent = {
  heroHeading: DEFAULT_HERO_HEADING,
  heroImageKey: null,
  facebookUrl: null,
  youtubeUrl: null,
  whatsappUrl: null,
  telegramUrl: null,
};

/** The social links, in the order the footer renders them. */
export const SOCIAL_FIELDS = [
  { name: "facebookUrl", label: "Facebook URL" },
  { name: "youtubeUrl", label: "YouTube URL" },
  { name: "whatsappUrl", label: "WhatsApp URL" },
  { name: "telegramUrl", label: "Telegram URL" },
] as const satisfies readonly { name: keyof SiteContent; label: string }[];
