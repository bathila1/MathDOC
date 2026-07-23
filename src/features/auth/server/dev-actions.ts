"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { otpRequestSchema } from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { recordStudentLogin } from "@/features/students/server/activity";

/**
 * DEV ONLY — "Simulate OTP" login used until SMSLenz is connected.
 * Creates/reuses a Supabase user for the phone number and signs in with a
 * deterministic dev password, so the whole app (RLS included) works exactly
 * as it will with real OTP. Refuses to run in production.
 */
export async function devLoginWithPhone(input: {
  phone: string;
}): Promise<ActionResult<{ next: string }>> {
  if (process.env.NODE_ENV === "production") {
    return fail("Simulated login is disabled in production.");
  }

  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const phone = parsed.data.phone;

  const devEmail = `${phone.replace("+", "")}@dev.mathdoc.local`;
  const devPassword = `dev-login-${phone.replace("+", "")}`;

  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  let userId = existing?.id as string | undefined;
  if (userId) {
    // Make sure the dev credentials work for this user.
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email: devEmail,
      password: devPassword,
      email_confirm: true,
    });
    if (error) return fail(`Dev login failed: ${error.message}`);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: devEmail,
      password: devPassword,
      email_confirm: true,
    });
    if (error || !created.user) {
      return fail(`Dev login failed: ${error?.message ?? "unknown error"}`);
    }
    userId = created.user.id;
    // The signup trigger created the profile; attach the phone number.
    const { error: phoneErr } = await admin
      .from("profiles")
      .update({ phone })
      .eq("id", userId);
    if (phoneErr) {
      return fail(
        "Dev login failed while saving the phone number. Did you run the SQL setup in Supabase?"
      );
    }
  }

  const supabase = await createSupabaseServer();
  const { data: signin, error: signErr } = await supabase.auth.signInWithPassword({
    email: devEmail,
    password: devPassword,
  });
  if (signErr || !signin.user) {
    return fail(`Dev login failed: ${signErr?.message ?? "unknown error"}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_completed, role")
    .eq("id", signin.user.id)
    .single();

  if (profile?.role === "admin") return ok({ next: "/admin" });
  await recordStudentLogin(signin.user.id);
  return ok({ next: profile?.profile_completed ? "/student" : "/register" });
}
