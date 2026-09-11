"use server";

import { createSupabaseServer } from "@/lib/server/supabase";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { getAuth } from "@/lib/server/auth";
import { getDebugErrorsEnabled } from "@/lib/server/settings";
import { clearResetGrant, hasResetGrant } from "@/lib/server/password-reset";
import {
  adminLoginSchema,
  changePasswordSchema,
  emailLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/shared/schemas";
import {
  ok,
  fail,
  fromZodError,
  type ActionResult,
} from "@/lib/shared/action-result";
import { recordStudentLogin } from "@/features/students/server/activity";
import { redirect } from "next/navigation";

/**
 * Student authentication: email + password.
 *
 * This replaced an SMS one-time-code login. The OTP travelled Supabase → our
 * Send-SMS hook → the Hutch gateway → the handset, so when Hutch stopped
 * accepting our credentials the entire front door shut with it. Email and a
 * password put the identity somewhere we control. SMS still carries booking
 * confirmations and certificate links; it is simply no longer the key.
 */

/**
 * Absolute URL for the links Supabase emails out.
 *
 * Returns null rather than guessing when NEXT_PUBLIC_APP_URL is missing or
 * malformed in production. A reset link pointing at http://localhost:3000 is
 * worse than no link at all: the send looks like it worked, and the student is
 * the one who discovers it didn't.
 */
function authRedirectUrl(
  /**
   * Must be a bare path with NO query string. Supabase glob-matches the whole
   * redirect_to against the project's allowlist, so a "?flow=..." suffix stops
   * it matching an allowlisted path — and Supabase then silently falls back to
   * the Site URL, dropping the student on the homepage with no error anywhere.
   * That is why recovery has its own route instead of a query flag.
   */
  path: string
): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) {
    if (process.env.NODE_ENV === "production") return null;
    return new URL(path, "http://localhost:3000").toString();
  }
  try {
    return new URL(path, raw).toString();
  } catch {
    return null;
  }
}

/** The same wording for a bad email and a bad password, so the form cannot be
 * used to discover which addresses have accounts. */
const BAD_CREDENTIALS = "Incorrect email or password.";

/**
 * Where a freshly signed-in user belongs. Mirrors the rules in
 * `lib/server/auth.ts` — a student who has not finished registering is sent to
 * finish it rather than to a dashboard with no name on it.
 */
async function destinationFor(
  // Takes the client that just authenticated rather than making a new one: the
  // session cookie is set during THIS request, and a fresh client reading it
  // back mid-request would be a bet on cookie-store timing. A miss here would
  // silently send every new signup to /register.
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, profile_completed")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return "/admin";
  await recordStudentLogin(userId);
  return profile?.profile_completed ? "/student" : "/register";
}

/** Create a student account. */
export async function signUpStudent(input: {
  email: string;
  password: string;
  confirmPassword: string;
  turnstileToken?: string;
}): Promise<ActionResult<{ next: string; checkEmail: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { email, password, turnstileToken } = parsed.data;

  // Cheapest check first, so a flood cannot make us issue unbounded siteverify
  // calls; the human check then runs before anything touches Supabase.
  const ip = await clientIp();
  const ipLimit = await rateLimit("signup", `ip:${ip}`);
  if (!ipLimit.allowed) return fail(ipLimit.message!);

  const human = await verifyTurnstile(turnstileToken, "student-signup");
  if (!human.ok) return fail(human.message!);

  const supabase = await createSupabaseServer();
  // Omitted rather than faked when the app URL is unset: Supabase then falls
  // back to the project's own Site URL, which is a working link.
  const emailRedirectTo = authRedirectUrl("/auth/confirm");
  if (!emailRedirectTo) {
    console.error(
      "NEXT_PUBLIC_APP_URL is missing or malformed — falling back to the " +
        "Supabase Site URL for the confirmation link. See docs/email-auth-setup.md."
    );
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  // Supabase reports an existing account two different ways depending on
  // whether email confirmation is switched on: an outright error when it is
  // off, and a decoy user with no identities when it is on.
  //
  // The array check is deliberately strict. If a future version simply stopped
  // returning identities, a ?.length === 0 test would be false — but treating an
  // ABSENT field as "already registered" would tell every genuine new student
  // their email was taken, which is far worse than missing the duplicate. So
  // only an actual empty array counts.
  const identities = data.user?.identities;
  const alreadyRegistered = error
    ? /already|registered|exists/i.test(error.message)
    : Array.isArray(identities) && identities.length === 0;

  if (alreadyRegistered) {
    // Deliberately says so plainly. This does confirm the address has an
    // account, which a strict reading of anti-enumeration would avoid — but
    // the honest message is what stops a student silently re-registering and
    // then wondering why their work is missing, and signup is rate limited per
    // IP. Password reset, where the same hint buys an attacker more, stays
    // neutral.
    return fail("That email already has an account. Try logging in instead.", {
      email: "This email is already registered.",
    });
  }

  if (error) {
    console.error("signUp failed:", error.status, error.message);
    if (await getDebugErrorsEnabled()) {
      return fail(`Sign-up failed: ${error.message}`);
    }
    return fail("We couldn't create your account. Please try again.");
  }

  // No session means the project requires email confirmation, so there is
  // nothing to log into yet.
  if (!data.session) {
    return ok({ next: "", checkEmail: true });
  }

  return ok({
    next: await destinationFor(supabase, data.session.user.id),
    checkEmail: false,
  });
}

/** Student login with email + password. */
export async function loginWithEmail(input: {
  email: string;
  password: string;
  turnstileToken?: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = emailLoginSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { email, password, turnstileToken } = parsed.data;

  const ip = await clientIp();
  const ipLimit = await rateLimit("login", `ip:${ip}`);
  if (!ipLimit.allowed) return fail(ipLimit.message!);

  const human = await verifyTurnstile(turnstileToken, "student-login");
  if (!human.ok) return fail(human.message!);

  // Also capped per account: without this an attacker rotating IPs could run
  // an unbounded password spray at one known student's address.
  const accountLimit = await rateLimit("login", `account:${email}`);
  if (!accountLimit.allowed) return fail(accountLimit.message!);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    console.error("signInWithPassword failed:", error?.status, error?.message);

    // Not a credentials problem, and saying so costs nothing: reaching this
    // branch already required the correct password.
    if (error && /not confirmed/i.test(error.message)) {
      return fail(
        "Please confirm your email address first — check your inbox for the link we sent."
      );
    }
    if (await getDebugErrorsEnabled()) {
      return fail(`Login failed: ${error?.message ?? "no user returned"}`);
    }
    return fail(BAD_CREDENTIALS);
  }

  return ok({ next: await destinationFor(supabase, data.user.id) });
}

/**
 * Email a password-reset link.
 *
 * Always reports success, even for an address with no account. The reply is
 * the whole attack surface here: a truthful "no such user" would turn this
 * form into a free membership oracle.
 */
export async function requestPasswordReset(input: {
  email: string;
  turnstileToken?: string;
}): Promise<ActionResult<undefined>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { email, turnstileToken } = parsed.data;

  const ip = await clientIp();
  const ipLimit = await rateLimit("password_reset", `ip:${ip}`);
  if (!ipLimit.allowed) return fail(ipLimit.message!);

  const human = await verifyTurnstile(turnstileToken, "password-reset");
  if (!human.ok) return fail(human.message!);

  // Per address too — otherwise one person's inbox can be buried from many IPs.
  const emailLimit = await rateLimit("password_reset", `email:${email}`);
  if (!emailLimit.allowed) return fail(emailLimit.message!);

  const redirectTo = authRedirectUrl("/auth/recovery");
  if (!redirectTo) {
    console.error(
      "Password reset is unavailable: NEXT_PUBLIC_APP_URL is missing or " +
        "malformed, so the emailed link would point nowhere. Set it in Vercel " +
        "and redeploy. See docs/email-auth-setup.md."
    );
    return fail(
      "Password reset isn't available right now. Please contact Sir."
    );
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Supabase answers successfully for an address with no account, so an
    // error here is never about the user — it is our own mail setup. That is
    // why it is safe to show under the debug toggle without leaking who has
    // an account.
    console.error(
      "resetPasswordForEmail failed:",
      error.status,
      error.message,
      "— check Supabase SMTP settings (docs/email-auth-setup.md)."
    );
    if (await getDebugErrorsEnabled()) {
      return fail(`Reset email failed: ${error.message}`);
    }
  }

  return ok(undefined);
}

/**
 * Finish a reset. Only reachable with the grant cookie that /auth/confirm sets
 * after verifying a recovery link — a plain logged-in session is not enough,
 * or an unlocked laptop would be a password change.
 */
export async function resetPassword(input: {
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  // The user comes first: the grant is bound to a specific account, so there
  // is nothing to verify it against until we know who is asking.
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await hasResetGrant(user.id))) {
    await clearResetGrant();
    return fail("That reset link has expired. Please request a new one.");
  }

  const rl = await rateLimit("form", `user:${user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error("resetPassword failed:", error.status, error.message);
    // Supabase rejects reusing the current password when that policy is on.
    return fail(
      /different from the old|same_password/i.test(error.message)
        ? "Please choose a password you haven't used before."
        : "We couldn't set that password. Please try again."
    );
  }

  // Half the point of a reset is locking out whoever prompted it, so every
  // OTHER session is revoked. The one that just set the password survives.
  const { error: signOutError } = await supabase.auth.signOut({
    scope: "others",
  });
  if (signOutError) {
    console.error(
      "Password was reset but other sessions were not revoked:",
      signOutError.message
    );
  }

  await clearResetGrant();
  return ok({ next: await destinationFor(supabase, user.id) });
}

/** Change the password from inside the account, proving the current one. */
export async function changePassword(input: {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<undefined>> {
  const auth = await getAuth();
  if (!auth) return fail("Please log in first.");

  const rl = await rateLimit("login", `user:${auth.user.id}`);
  if (!rl.allowed) return fail(rl.message!);

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const email = auth.profile.email;
  if (!email) {
    return fail("This account has no email address yet. Please contact Sir.");
  }

  const supabase = await createSupabaseServer();

  // updateUser() does NOT check the existing password, so prove it here.
  // Signing in again as the same user simply refreshes their own session.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) {
    return fail("That current password isn't right.", {
      currentPassword: "Incorrect password.",
    });
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error("changePassword failed:", error.status, error.message);
    return fail(
      /different from the old|same_password/i.test(error.message)
        ? "Please choose a password you haven't used before."
        : "We couldn't change your password. Please try again."
    );
  }

  // Someone changing their password on a shared or lost device expects that
  // to end the other sessions. Theirs stays.
  const { error: signOutError } = await supabase.auth.signOut({
    scope: "others",
  });
  if (signOutError) {
    console.error(
      "Password was changed but other sessions were not revoked:",
      signOutError.message
    );
  }

  return ok(undefined);
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
    // Supabase answers wrong-email and wrong-password identically, so even
    // the detailed form here does not reveal whether an account exists.
    if (await getDebugErrorsEnabled()) {
      return fail(`Admin login failed: ${error?.message ?? "no user returned"}`);
    }
    return fail(BAD_CREDENTIALS);
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
