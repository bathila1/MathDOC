"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpStudent } from "@/features/auth/server/actions";
import { PasswordInput } from "@/features/auth/client/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TurnstileWidget,
  turnstileEnabled,
} from "@/components/security/TurnstileWidget";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MailCheck } from "lucide-react";

/** Mirrors newPasswordField in lib/shared/schemas.ts. The server is what
 * enforces these; showing them up front just stops the guessing game. */
const RULES = "At least 10 characters, including a letter and a number.";

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checkEmail, setCheckEmail] = useState(false);
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await signUpStudent({
        email,
        password,
        confirmPassword,
        turnstileToken: token ?? "",
      });
      if (!res.ok) {
        setError(res.fieldErrors ? null : res.error);
        setFieldErrors(res.fieldErrors ?? {});
        setToken(null);
        setCaptchaKey((k) => k + 1);
        return;
      }
      // The project requires email confirmation, so there is no session yet.
      if (res.data.checkEmail) {
        setCheckEmail(true);
        return;
      }
      router.push(res.data.next);
      router.refresh();
    });
  }

  if (checkEmail) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-5 text-primary" aria-hidden />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong>{email}</strong>. Open it to
            finish creating your account, then come back and log in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing after a few minutes? Check your spam folder, and make sure
            the address above is spelled correctly.
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full"
            render={<Link href="/login" />}
          >
            Back to login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Sign up with your email address. You&apos;ll add your name, school and
          contact details next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors.email) || undefined}
              autoFocus
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password ? (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{RULES}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              invalid={Boolean(fieldErrors.confirmPassword)}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-sm text-destructive">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <TurnstileWidget
            action="student-signup"
            onToken={setToken}
            resetKey={captchaKey}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={pending || (turnstileEnabled && !token)}
          >
            {pending ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
