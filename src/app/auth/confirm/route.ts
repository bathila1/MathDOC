import { NextRequest, NextResponse } from "next/server";
import { consumeAuthLink, recoveryResponse } from "@/lib/server/auth-links";

/**
 * Where signup-confirmation and email-change links land.
 *
 * Password reset has its own route, /auth/recovery — see auth-links.ts for
 * why these are separate paths rather than one path with a query flag.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;

  const result = await consumeAuthLink(request);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/login?error=${result.failure}`, origin)
    );
  }

  // A recovery template pointed here rather than at /auth/recovery. Honour it
  // rather than dropping someone mid-reset into the dashboard with no way to
  // set the password they came to set.
  if (searchParams.get("type") === "recovery") {
    return recoveryResponse(origin, result.userId);
  }

  // /student sends an unfinished profile on to /register, so this one
  // destination is right for a brand-new account and a returning one alike.
  return NextResponse.redirect(new URL("/student", origin));
}
