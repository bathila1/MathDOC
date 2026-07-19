import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase";
import type { Profile } from "@/lib/shared/types";
import type { User } from "@supabase/supabase-js";

export interface AuthContext {
  user: User;
  profile: Profile;
}

/** Current session's user + profile, or null when logged out. */
export async function getAuth(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { user, profile: profile as Profile };
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
