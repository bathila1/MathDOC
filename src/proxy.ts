import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next 16's middleware): refreshes the Supabase session cookie and
 * guards /student and /admin routes. Role checks are re-enforced in
 * layouts/server actions (and by RLS) — this is the first, fast gate.
 *
 * Perf: this runs on every navigation AND every link prefetch, so it must be
 * cheap. We use getSession() (a local cookie read that only hits the network
 * to refresh an expiring token) instead of getUser() (a network round-trip to
 * the Auth server on every single call). The redirect gate only needs to know
 * whether a session exists; the token is genuinely validated in getAuth() and
 * by RLS, so a forged cookie that slips past here is rejected there anyway.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: keep between client creation and returning — this both refreshes
  // an expiring session (persisting the rotated token via setAll above) and
  // tells us whether the visitor is signed in. Local read; no Auth round-trip.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isAdminLogin = pathname.startsWith("/admin/login");
  const needsAuth =
    pathname.startsWith("/student") ||
    (pathname.startsWith("/admin") && !isAdminLogin);

  if (needsAuth && !session) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
