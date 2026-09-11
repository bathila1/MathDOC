import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase";
import type { Profile } from "@/lib/shared/types";

export interface AuthContext {
  /**
   * The authenticated user. Only `id` is exposed because that is all the app
   * has ever used, and obtaining the rest would cost an Auth-server round-trip
   * on every page (see getAuth).
   */
  user: { id: string };
  profile: Profile;
}

/** Read the `sub` (user id) claim straight from the JWT — no network, no
 * signature check (getUser below is what actually validates the token). Lets
 * us start the profile query in parallel instead of waiting on getUser first. */
function subFromToken(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const sub = JSON.parse(json).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Current session's user + profile, or null when logged out.
 * Wrapped in React `cache()` so the layout and page in one navigation share a
 * single auth resolution instead of firing it two or three times.
 *
 * ONE network call, not two. This used to also run `supabase.auth.getUser()`
 * in parallel to prove the token was genuine. That is redundant: PostgREST
 * verifies the JWT signature and expiry itself before it will run any query,
 * so a profile row coming back is already proof of a valid token. Verified
 * against this project rather than assumed — a JWT with a tampered signature
 * gets `401 PGRST301 "None of the keys was able to decode the JWT"`, and no
 * Authorization header at all gets `401` (anon has no SELECT grant on
 * profiles). Neither returns a row.
 *
 * The remaining links in the chain:
 *  - `userId` is decoded from the token WITHOUT checking the signature, so on
 *    its own it is untrusted. It becomes trustworthy because the query it is
 *    used in only succeeds if that same token string verifies.
 *  - RLS on profiles is `id = auth.uid() or is_admin()`, and `auth.uid()` comes
 *    from the verified claims — so for a student the row is doubly tied to the
 *    real subject.
 *  - `profiles.id references auth.users on delete cascade`, so a deleted user
 *    has no profile row and is logged out on their next request.
 *
 * Known trade-off: Supabase's `banned_until` is enforced by the Auth server,
 * not by PostgREST, so banning a user would leave their existing access token
 * working until it expires (up to the JWT TTL, default 1 hour). The app has no
 * ban feature — deletion is the mechanism, and that IS immediate via the
 * cascade above. If banning is ever added, revoke by deleting the profile row
 * or shorten the JWT TTL.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createSupabaseServer();

  // Local cookie read (only hits the network to refresh a truly expired token).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const userId = subFromToken(session.access_token);
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // Covers all of: invalid signature, expired token, deleted user, RLS denial.
  if (!data) return null;

  const profile = data as Profile;
  if (profile.id !== userId) return null; // defensive; RLS already enforces it

  return { user: { id: userId }, profile };
});

/** Where a signed-in user belongs when they land on a login page. */
function homeFor(profile: Profile): string {
  if (profile.role === "admin") return "/admin";
  return profile.profile_completed ? "/student" : "/register";
}

/** Only same-site paths may come back from `?next=` — never an absolute URL. */
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/**
 * Guard for the login pages. A student stays signed in until they log out, so
 * reaching /login with a live session means they tapped "Student login" out of
 * habit — send them straight in rather than making them wait for another OTP.
 *
 * Uses getAuth() (which validates the token against the Auth server) rather
 * than a bare cookie check: a stale cookie must fall through to the form, not
 * bounce between /login and /student forever.
 */
export async function redirectIfSignedIn(next?: string): Promise<void> {
  const auth = await getAuth();
  if (!auth) return;
  redirect(safeNext(next) ?? homeFor(auth.profile));
}

/** For student pages/actions: redirects to /login when not signed in. */
export async function requireStudent(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.profile.role !== "student") redirect("/admin");
  return auth;
}

/** For admin pages/actions: redirects to /admin/login when not the teacher. */
export async function requireAdmin(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/admin/login");
  if (auth.profile.role !== "admin") redirect("/student");
  return auth;
}

/**
 * Run a page's data fetch CONCURRENTLY with the access check.
 *
 * Pages used to `await requireAdmin()` and only then start querying: two
 * round-trips to Supabase in series. Locally that is invisible; in production
 * each one costs 100ms+, so it was roughly a quarter of a second before any
 * HTML could be produced, on every single admin page. Starting both together
 * removes one of them.
 *
 * SAFE ONLY FOR RLS-SCOPED FETCHES. `fetcher` must query through
 * `createSupabaseServer()`, which runs as the visitor: a non-admin gets empty
 * results and is redirected anyway, so nothing crosses a boundary. Never pass
 * a fetcher that uses `createSupabaseAdmin()` — the service role bypasses RLS,
 * and the guard you are racing is the only thing in front of it.
 *
 * Callers needing the profile can still `await requireAdmin()` afterwards;
 * getAuth() is request-cached, so that costs nothing.
 */
export async function withAdmin<T>(fetcher: () => PromiseLike<T>): Promise<T> {
  // Promise.resolve so a Supabase query builder (a thenable, not a Promise)
  // can be passed straight in.
  const pending = Promise.resolve(fetcher());
  // When the guard redirects it throws, and nothing ever awaits `pending`.
  // Attach a no-op catch so that cannot surface as an unhandled rejection.
  pending.catch(() => {});
  await requireAdmin();
  return pending;
}

/**
 * The session's user id straight from the cookie, with NO round-trip.
 *
 * Student pages need the id to build their queries, and used to get it from
 * requireStudent() — which meant waiting on the profiles query before any page
 * query could even start. The id is already in the JWT, so read it locally and
 * let withStudent() overlap the guard with the data fetch.
 *
 * Untrusted on its own (the signature is not checked here), and that is fine:
 * every query it feeds runs under RLS, where `auth.uid()` comes from the
 * VERIFIED token. A tampered sub yields no rows, and requireStudent() — still
 * awaited before anything is rendered — redirects them regardless.
 */
export async function sessionUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? subFromToken(session.access_token) : null;
}

/** The same overlap for student pages. See withAdmin for the safety rule. */
export async function withStudent<T>(fetcher: () => PromiseLike<T>): Promise<T> {
  const pending = Promise.resolve(fetcher());
  pending.catch(() => {});
  await requireStudent();
  return pending;
}
