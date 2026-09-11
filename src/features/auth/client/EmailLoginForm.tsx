"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginWithEmail } from "@/features/auth/server/actions";
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

/** Why /auth/confirm sent them here, when it did. */
const LINK_ERRORS = {
  link: "That link has expired or has already been used. Request a new one below.",
  "link-browser":
    "That link couldn't be opened here. Email links have to be opened in the same browser you requested them from — or just request a new one below.",
} as const;

export function EmailLoginForm({
  linkError = null,
}: {
  linkError?: keyof typeof LINK_ERRORS | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    // /auth/confirm bounces here rather than showing a blank page when an
    // email link fails, and says which way it failed.
    linkError ? LINK_ERRORS[linkError] : null
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  // Turnstile tokens are single-use, so a failed attempt needs a fresh one.
  const [captchaKey, setCaptchaKey] = useState(0);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await loginWithEmail({
        email,
        password,
        turnstileToken: token ?? "",
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        setToken(null);
        setCaptchaKey((k) => k + 1);
        return;
      }
      router.push(res.data.next);
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Student login</CardTitle>
        <CardDescription>
          Log in with the email address and password you registered with.
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
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password && (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <TurnstileWidget
            action="student-login"
            onToken={setToken}
            resetKey={captchaKey}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={pending || (turnstileEnabled && !token)}
          >
            {pending ? "Logging in…" : "Log in"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link
              href="/signup"
              className="text-primary underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
