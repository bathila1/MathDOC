"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@/features/auth/server/actions";
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
import { formatPhone } from "@/lib/shared/phone";

export function OtpVerifyForm({ phone }: { phone: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  // Tokens are single-use, and this page spends them on two different actions
  // (verify + resend), so mint a fresh one after every attempt.
  const [captchaKey, setCaptchaKey] = useState(0);

  function nextCaptcha() {
    setToken(null);
    setCaptchaKey((k) => k + 1);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyOtp({ phone, code, turnstileToken: token ?? "" });
      if (!res.ok) {
        setError(res.fieldErrors?.code ?? res.error);
        nextCaptcha();
        return;
      }
      router.push(res.data.next);
      router.refresh();
    });
  }

  function resend() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await requestOtp({ phone, turnstileToken: token ?? "" });
      if (!res.ok) setError(res.error);
      else setInfo("We sent you a new code.");
      nextCaptcha();
    });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Enter the code</CardTitle>
        <CardDescription>
          We sent a 6-digit code by SMS to {formatPhone(phone)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Login code</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
          </div>
          <TurnstileWidget
            action="otp-verify"
            onToken={setToken}
            resetKey={captchaKey}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={
              pending || code.length !== 6 || (turnstileEnabled && !token)
            }
          >
            {pending ? "Checking…" : "Log in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={pending || (turnstileEnabled && !token)}
            onClick={resend}
          >
            Resend code
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
