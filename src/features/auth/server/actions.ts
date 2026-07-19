"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import {
  adminLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
} from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { redirect } from "next/navigation";

/** Step 1 of student login: send a one-time code by SMS. */
export async function requestOtp(input: {
  phone: string;
}): Promise<ActionResult<{ phone: string }>> {
  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { phone } = parsed.data;

  const ip = await clientIp();
  for (const key of [`phone:${phone}`, `ip:${ip}`]) {
    const rl = await rateLimit("otp", key);
    if (!rl.allowed) return fail(rl.message!);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error("signInWithOtp failed:", error.message);
    return fail(
      "We couldn't send the code right now. Please check the number and try again."
    );
  }
  return ok({ phone });
}

/** Step 2 of student login: verify the 6-digit code. */
export async function verifyOtp(input: {
  phone: string;
  code: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = otpVerifySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { phone, code } = parsed.data;

  const rl = await rateLimit("otp_verify", `phone:${phone}`);
  if (!rl.allowed) return fail(rl.message!);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  });

  if (error || !data.user) {
    return fail("That code didn't match. Please check the SMS and try again.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_completed, role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role === "admin") return ok({ next: "/admin" });
  return ok({ next: profile?.profile_completed ? "/student" : "/register" });
}

/** Admin (teacher) login with email + password. */
export async function adminLogin(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const ip = await clientIp();
  const rl = await rateLimit("login", `ip:${ip}`);
  if (!rl.allowed) return fail(rl.message!);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return fail("Incorrect email or password.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return fail("This login is for the teacher only.");
  }
  return ok({ next: "/admin" });
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
