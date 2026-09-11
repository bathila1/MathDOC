import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minting and checking the password-reset grant.
 *
 * Kept separate from `password-reset.ts` (and free of its `server-only` and
 * `next/headers` imports) so the crypto can be exercised directly by a test
 * without dragging in the request context. Only server code imports it.
 *
 * See password-reset.ts for WHY the grant is signed rather than a plain flag.
 */

/** Long enough to choose a password, short enough that a shared machine does
 * not stay armed. */
export const RESET_WINDOW_SECONDS = 15 * 60;

/**
 * Signing key. Reuses the service-role key rather than adding another required
 * env var: it is server-only, high-entropy, already mandatory for the app to
 * run at all, and it is never used as an HMAC key anywhere else. The fixed
 * prefix in the signed payload keeps these signatures domain-separated.
 */
function signingKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // Fail closed. Without a key we cannot tell a real grant from a forged
    // one, and guessing would reopen the hole this exists to close.
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to sign password-reset grants."
    );
  }
  return key;
}

function sign(userId: string, expiresAt: number): string {
  return createHmac("sha256", signingKey())
    .update(`pw-reset.${userId}.${expiresAt}`)
    .digest("base64url");
}

/** Cookie value granting this user a password reset, valid for the window. */
export function issueResetGrant(userId: string): string {
  const expiresAt = Date.now() + RESET_WINDOW_SECONDS * 1000;
  return `${expiresAt}.${sign(userId, expiresAt)}`;
}

/** Whether `raw` is a grant this server issued, for this user, still in date. */
export function verifyResetGrant(
  raw: string | undefined,
  userId: string
): boolean {
  if (!raw) return false;

  const separator = raw.indexOf(".");
  if (separator < 1) return false;

  const expiresAt = Number(raw.slice(0, separator));
  const presented = raw.slice(separator + 1);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  // The cookie's own maxAge already expires it in a well-behaved browser; the
  // expiry is re-checked here because the value is client-supplied and a
  // crafted request need not honour maxAge at all.
  const expected = sign(userId, expiresAt);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
