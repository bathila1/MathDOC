"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/features/auth/server/actions";
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

/** Why /auth/recovery sent them back here, when it did. */
const LINK_ERRORS = {
  link: "That reset link has expired or has already been used. Request a new one below.",
  "link-browser":
    "That reset link has to be opened in the same browser you requested it from. Request a new one below, then paste the link into this window.",
} as const;

/**
 * The Supabase project's own origin, which is where the default email
 * templates point. Used to sanity-check a pasted link — see openPastedLink.
 */
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
})();

export function ForgotPasswordForm({
  linkError = null,
}: {
  linkError?: keyof typeof LINK_ERRORS | null;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    linkError ? LINK_ERRORS[linkError] : null
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [pastedLink, setPastedLink] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await requestPasswordReset({
        email,
        turnstileToken: token ?? "",
      });
      if (!res.ok) {
        setError(res.fieldErrors ? null : res.error);
        setFieldErrors(res.fieldErrors ?? {});
        setToken(null);
        setCaptchaKey((k) => k + 1);
        return;
      }
      setSent(true);
    });
  }

  /**
   * Open a reset link the student pasted from their email.
   *
   * This exists because the reset link is bound to the browser that asked for
   * it: the PKCE code verifier lives in a cookie here, so tapping the link on
   * a phone after asking on a laptop cannot work. Pasting the address into
   * THIS window carries it back to the cookie that can complete it.
   *
   * A full navigation, not a fetch — the redirect chain has to run in the
   * browser so the session cookies land.
   */
  function openPastedLink(e: React.FormEvent) {
    e.preventDefault();
    setPasteError(null);

    const raw = pastedLink.trim();
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      setPasteError(
        "That doesn't look like a web address. Copy the whole link from the email, starting with https://"
      );
      return;
    }

    // Only our own site or the Supabase project that sent the mail. Navigating
    // to anything a stranger talked someone into pasting here is not a door
    // worth leaving open.
    const allowed = [window.location.origin, SUPABASE_ORIGIN].filter(Boolean);
    if (!allowed.includes(url.origin)) {
      setPasteError(
        "That link isn't from MathDOC. Paste the reset link from the email we just sent."
      );
      return;
    }

    window.location.href = url.toString();
  }

  // Shown whether or not that address has an account — the server deliberately
  // answers the same way either way, so this screen must not hint otherwise.
  if (sent) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-5 text-primary" aria-hidden />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If <strong>{email}</strong> has an account, a link to set a new
            password is on its way. It expires in one hour.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium">
              Open the link in this window
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The reset link only works in the browser you asked from. If you
              read your email somewhere else — on your phone, or in another
              browser — <strong>copy the link</strong> and paste it below
              instead of tapping it.
            </p>

            <form onSubmit={openPastedLink} className="mt-3 space-y-2">
              <Label htmlFor="pasted-link" className="sr-only">
                Paste your reset link
              </Label>
              <Input
                id="pasted-link"
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={pastedLink}
                onChange={(e) => setPastedLink(e.target.value)}
                aria-invalid={Boolean(pasteError) || undefined}
              />
              {pasteError && (
                <p className="text-sm text-destructive">{pasteError}</p>
              )}
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={!pastedLink.trim()}
              >
                Open reset link
              </Button>
            </form>
          </div>

          <p className="text-sm text-muted-foreground">
            Nothing after a few minutes? Check your spam folder, and make sure
            the address above is the one you registered with.
          </p>

          <Button
            variant="outline"
            className="w-full"
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
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to set a new
          one.
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <TurnstileWidget
            action="password-reset"
            onToken={setToken}
            resetKey={captchaKey}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={pending || (turnstileEnabled && !token)}
          >
            {pending ? "Sending…" : "Send reset link"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Back to login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
