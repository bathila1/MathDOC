import "server-only";
import { clientIp } from "./ratelimit";

/**
 * Cloudflare Turnstile verification.
 *
 * The widget in the browser is only a token *producer* — it proves nothing on
 * its own, because anyone can POST a server action directly with a made-up
 * token. This module is where the check actually happens: every token is
 * redeemed against Cloudflare's siteverify endpoint before the action runs.
 *
 * Tokens are single-use and expire after ~5 minutes; Cloudflare enforces both
 * (a replay comes back as `timeout-or-duplicate`), so we do not need our own
 * token store.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 8_000;

/**
 * Which form a token was minted for. Turnstile echoes the widget's `action`
 * back in the verify response, so a token harvested from the (cheap, public)
 * student-login widget cannot be replayed against the admin-login action.
 */
export type TurnstileAction =
  | "student-login"
  | "student-signup"
  | "password-reset"
  | "admin-login";

export interface TurnstileResult {
  ok: boolean;
  /** User-facing reason; safe to display. */
  message?: string;
}

const GENERIC_FAIL =
  "The human check didn't pass. Please refresh the page and try again.";
const EXPIRED =
  "The human check expired. Please try again.";

/** Whether Turnstile is switched on for this deployment. */
export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Verify a Turnstile token.
 *
 * FAILS CLOSED in production when `TURNSTILE_SECRET_KEY` is missing. A bot
 * defence that silently disables itself because an env var wasn't copied is
 * worse than none at all — you'd believe you were protected. Local development
 * without a key skips the check so the login flow still works offline.
 */
export async function verifyTurnstile(
  token: string,
  /**
   * Which widget(s) may have minted this token. A list is allowed where one
   * endpoint is legitimately reachable from two forms — "resend code" on the
   * verify page hits `requestOtp` with an `otp-verify` token. Both guard the
   * same operation (send an SMS to a number the user just supplied), so
   * accepting either grants nothing extra; what this still prevents is a token
   * from the public login widget being spent on `admin-login`.
   */
  action: TurnstileAction | TurnstileAction[]
): Promise<TurnstileResult> {
  const allowed = Array.isArray(action) ? action : [action];
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "TURNSTILE_SECRET_KEY is not set — refusing to accept the request. " +
          "Set it in the hosting environment (see docs/deployment.md)."
      );
      return { ok: false, message: GENERIC_FAIL };
    }
    return { ok: true }; // dev-only: no key configured, check skipped
  }

  if (!token) return { ok: false, message: GENERIC_FAIL };

  const body = new URLSearchParams({
    secret,
    response: token,
    // Binds the token to the caller's address. Read from platform headers, not
    // raw x-forwarded-for, so it can't be spoofed (see clientIp).
    remoteip: await clientIp(),
    // Lets a retried verification of the same token succeed rather than
    // tripping Cloudflare's duplicate detection.
    idempotency_key: crypto.randomUUID(),
  });

  let payload: {
    success?: boolean;
    action?: string;
    "error-codes"?: string[];
  };

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Turnstile siteverify HTTP", res.status);
      return { ok: false, message: GENERIC_FAIL };
    }
    payload = await res.json();
  } catch (err) {
    // Network failure or timeout. Still fails closed: an attacker who can
    // black-hole Cloudflare must not thereby switch the check off.
    console.error("Turnstile siteverify failed:", err);
    return { ok: false, message: GENERIC_FAIL };
  }

  if (!payload.success) {
    const codes = payload["error-codes"] ?? [];
    // Don't log the token itself — it is a bearer credential.
    console.warn("Turnstile rejected a token:", codes.join(","));
    if (codes.includes("timeout-or-duplicate")) {
      return { ok: false, message: EXPIRED };
    }
    return { ok: false, message: GENERIC_FAIL };
  }

  // A valid token for the *wrong* form is still a failure.
  if (
    payload.action &&
    !allowed.includes(payload.action as TurnstileAction)
  ) {
    console.warn(
      `Turnstile action mismatch: got "${payload.action}", expected one of ${allowed.join("|")}`
    );
    return { ok: false, message: GENERIC_FAIL };
  }

  return { ok: true };
}
