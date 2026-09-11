import { NextRequest, NextResponse } from "next/server";
import { consumeAuthLink, recoveryResponse } from "@/lib/server/auth-links";

/**
 * Where password-reset links land.
 *
 * On failure this returns to /forgot-password, not /login: whoever is here was
 * trying to reset a password, and the useful next step is requesting a fresh
 * link from the device they are actually holding — not hunting for the old
 * email again. That matters most for the "right link, wrong browser" case,
 * which is precisely the one where re-requesting here fixes it.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;

  const result = await consumeAuthLink(request);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/forgot-password?error=${result.failure}`, origin)
    );
  }

  return recoveryResponse(origin, result.userId);
}
