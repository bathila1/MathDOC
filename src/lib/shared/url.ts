/**
 * URL safety helpers.
 *
 * React escapes text, but it does NOT sanitize `href`/`src` attributes: a
 * stored value of `javascript:alert(document.cookie)` rendered into an anchor
 * runs as script the moment a user clicks it. Every externally-supplied link
 * (task media URLs, meeting links) must pass through here before reaching the
 * DOM, and be validated with `httpUrlField` on the way into the database.
 */

/** Only these schemes may ever reach an href/src we render. */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Return the URL only if it is a well-formed http(s) URL, otherwise null.
 * Callers render nothing when this returns null, which fails closed.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // Note: the URL constructor happily parses "javascript:alert(1)" — the
    // protocol allowlist below is what actually does the filtering, so it
    // must never be relaxed to a substring/startsWith check.
    const parsed = new URL(trimmed);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null; // relative or malformed — not a valid external link
  }
}

/** True when the value is a safe http(s) URL. */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  return safeExternalUrl(raw) !== null;
}
