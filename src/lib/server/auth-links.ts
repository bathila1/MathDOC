import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "./supabase";
import {
  RESET_COOKIE,
  issueResetGrant,
  resetCookieOptions,
} from "./password-reset";

/**
 * Shared handling for the links Supabase emails out.
 *
 * There are two landing routes, and they are deliberately separate PATHS
 * rather than one path with a `?flow=` query parameter:
 *
 *   /auth/confirm   — signup confirmation, email change
 *   /auth/recovery  — password reset
 *
 * Supabase validates `redirect_to` against the project's Redirect URLs
 * allowlist by glob-matching the WHOLE url, query string included. An
 * allowlist entry of `https://site/auth/confirm` therefore does NOT match
 * `https://site/auth/confirm?flow=recovery`, and Supabase silently falls back
 * to the Site URL — the student lands on the homepage and nothing happens, with
 * no error anywhere. Query-free paths cannot fail that way.
 */

export type LinkFailure =
  /** Expired, already spent, or malformed. */
  | "link"
  /** PKCE: right link, wrong browser. */
  | "link-browser";

export type LinkResult =
  | { ok: true; userId: string }
  | { ok: false; failure: LinkFailure };

/**
 * Verify whatever token an emailed link carried, establishing a session.
 *
 * Accepts both shapes, because which one arrives depends on the project's
 * email templates:
 *
 *  - `token_hash` + `type` → verifyOtp. Works in ANY browser, which matters
 *    because students routinely open mail on a phone after asking on a laptop.
 *    Requires templates using {{ .TokenHash }} (see docs/email-auth-setup.md),
 *    which in turn requires custom SMTP.
 *  - `code` → exchangeCodeForSession. What Supabase's DEFAULT templates
 *    produce. It is PKCE: the code verifier sits in a cookie belonging to the
 *    browser that made the request, so opening the mail elsewhere cannot work.
 */
export async function consumeAuthLink(
  request: NextRequest
): Promise<LinkResult> {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createSupabaseServer();

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error || !data.user) {
      console.error(
        `Auth link failed (token_hash, type=${type}):`,
        error?.message ?? "no user returned"
      );
      return { ok: false, failure: "link" };
    }
    return { ok: true, userId: data.user.id };
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error(
        "Auth link failed (pkce code):",
        error?.message ?? "no user returned"
      );
      return { ok: false, failure: "link-browser" };
    }
    return { ok: true, userId: data.user.id };
  }

  console.error(
    "Auth link carried no token. If the student landed on the homepage " +
      "instead, the redirect URL is missing from the Supabase allowlist — " +
      "see docs/email-auth-setup.md."
  );
  return { ok: false, failure: "link" };
}

/**
 * Send a verified recovery visitor on to set their password, stamping the
 * signed grant that /reset-password requires. See lib/server/password-reset.ts
 * for why a session alone is not enough, and why the grant is signed.
 */
export function recoveryResponse(origin: string, userId: string): NextResponse {
  const response = NextResponse.redirect(new URL("/reset-password", origin));
  response.cookies.set(
    RESET_COOKIE,
    issueResetGrant(userId),
    resetCookieOptions()
  );
  return response;
}
