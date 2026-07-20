"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp } from "@/features/auth/server/actions";
import { devLoginWithPhone } from "@/features/auth/server/dev-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PhoneLoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestOtp({ phone });
      if (!res.ok) {
        setError(res.fieldErrors?.phone ?? res.error);
        return;
      }
      router.push(`/login/verify?phone=${encodeURIComponent(res.data.phone)}`);
    });
  }

  // Until SMSLenz is connected: logs straight in without a real OTP (dev only).
  function simulate() {
    setError(null);
    startTransition(async () => {
      const res = await devLoginWithPhone({ phone });
      if (!res.ok) {
        setError(res.fieldErrors?.phone ?? res.error);
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
          Enter your mobile number and we&apos;ll text you a one-time login code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="0771234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending code…" : "Send login code"}
          </Button>
          {process.env.NODE_ENV !== "production" && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={simulate}
            >
              🧪 Simulate OTP login (dev — no SMS needed)
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
