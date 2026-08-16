"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { verifyTurnstile } from "@/lib/server/turnstile";
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
import { recordStudentLogin } from "@/features/students/server/activity";
import { redirect } from "next/navigation";

/** Step 1 of student login: send a one-time code by SMS. */
export async function requestOtp(input: {
  phone: string;
  turnstileToken?: string;
}): Promise<ActionResult<{ phone: string }>> {
  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { phone, turnstileToken } = parsed.data;

  const ip = await clientIp();

  // Order matters. The cheap per-IP limit runs first so a flood can't make us
  // issue unbounded siteverify calls. The human check runs BEFORE the per-phone
  // limit so a bot cannot burn a real student's OTP budget and lock them out —
  // every request that reaches the phone bucket has already proven itself.
  const ipLimit = await rateLimit("otp", `ip:${ip}`);
  if (!ipLimit.allowed) return fail(ipLimit.message!);

  // "Resend code" reaches this action from the verify page, whose widget mints
  // otp-verify tokens — both are accepted here (see verifyTurnstile).
  const human = await verifyTurnstile(turnstileToken, [
    "student-login",
    "otp-verify",
  ]);
  if (!human.ok) return fail(human.message!);

  const phoneLimit = await rateLimit("otp", `phone:${phone}`);
  if (!phoneLimit.allowed) return fail(phoneLimit.message!);

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error("signInWithOtp failed:", error.status, error.message);
    // Production keeps the reason private (it can name providers/config).
    // Locally, surfacing it turns a dead end into an actionable message.
    if (process.env.NODE_ENV !== "production") {
      return fail(`Supabase couldn't send the OTP: ${error.message}`);
    }
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
  turnstileToken?: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = otpVerifySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { phone, code, turnstileToken } = parsed.data;

  // A 6-digit code is only 10^6 wide, so this is the endpoint worth brute
  // forcing. Limit by IP as well as by phone: without the IP bucket an attacker
  // can spread guesses across many stolen numbers unimpeded.
  const ip = await clientIp();
  const ipLimit = await rateLimit("otp_verify", `ip:${ip}`);
  if (!ipLimit.allowed) return fail(ipLimit.message!);

  const human = await verifyTurnstile(turnstileToken, "otp-verify");
  if (!human.ok) return fail(human.message!);

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
  await recordStudentLogin(data.user.id);
  return ok({ next: profile?.profile_completed ? "/student" : "/register" });
}

/** Admin (teacher) login with email + password. */
export async function adminLogin(input: {
  email: string;
  password: string;
  turnstileToken?: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const ip = await clientIp();
  const rl = await rateLimit("login", `ip:${ip}`);
  if (!rl.allowed) return fail(rl.message!);

  const human = await verifyTurnstile(parsed.data.turnstileToken, "admin-login");
  if (!human.ok) return fail(human.message!);

  // The teacher account is the highest-value credential on the site, so guesses
  // are also capped per account — an attacker rotating IPs still can't run an
  // unbounded password spray against it.
  const accountLimit = await rateLimit("login", `account:${parsed.data.email}`);
  if (!accountLimit.allowed) return fail(accountLimit.message!);

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
