import "server-only";
import { cookies } from "next/headers";
import {
  RESET_WINDOW_SECONDS,
  issueResetGrant,
  verifyResetGrant,
} from "./reset-grant";

/**
 * The "this session arrived via a recovery link" grant.
 *
 * A recovery link produces a real, fully-privileged session — exactly the kind
 * a normal login produces. So /reset-password cannot simply require a session:
 * anyone who found an unlocked laptop could then set a new password without
 * knowing the old one, and keep the account after the owner logged out.
 *
 * The grant marks the difference. It is SIGNED rather than a plain flag,
 * because `httpOnly` only stops JavaScript — it does nothing against someone
 * editing the cookie in DevTools or replaying a crafted request, and a bare
 * `=1` was forgeable by exactly the attacker this is meant to stop. Each grant
 * is an HMAC over the user id and an expiry (see reset-grant.ts), so it cannot
 * be minted, re-dated, or moved to another account without the server key.
 *
 * Changing a password from an ordinary session is a different door:
 * changePassword() re-authenticates with the current password instead.
 */

export const RESET_COOKIE = "mathdoc-pw-reset";

export { RESET_WINDOW_SECONDS, issueResetGrant };

export function resetCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Set from a Route Handler on http://localhost in dev, where `secure`
    // would stop the cookie being stored at all.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RESET_WINDOW_SECONDS,
  };
}

/** Whether the caller holds a grant this server issued, for THIS user. */
export async function hasResetGrant(userId: string): Promise<boolean> {
  const raw = (await cookies()).get(RESET_COOKIE)?.value;
  return verifyResetGrant(raw, userId);
}

export async function clearResetGrant(): Promise<void> {
  (await cookies()).delete(RESET_COOKIE);
}
