import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase";
import type { Profile } from "@/lib/shared/types";
import type { User } from "@supabase/supabase-js";

export interface AuthContext {
  user: User;
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
 * single auth resolution instead of firing 2–3 round-trips.
 *
 * getUser() revalidates the token against the Auth server (a network hop). We
 * decode the user id from the session cookie locally so the profile query can
 * run *in parallel* with that validation rather than after it — halving the
 * per-navigation auth latency. Correctness is unchanged: we still bail unless
 * getUser() confirms the token is genuine.
 *
 * Further win available: migrate the Supabase project to asymmetric JWT signing
 * keys (Dashboard → Auth → JWT Keys), then swap getUser() for getClaims() here
 * to verify the token locally and drop the Auth-server hop entirely.
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

  // Validate the token and load the profile at the same time.
  const [userRes, profileRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("*").eq("id", userId).single(),
  ]);

  const user = userRes.data.user;
  if (!user) return null; // token invalid/expired — treat as logged out
  if (!profileRes.data) return null;

  return { user, profile: profileRes.data as Profile };
});

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
