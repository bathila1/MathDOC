"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/features/auth/server/actions";
import { PasswordInput } from "@/features/auth/client/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

/** Mirrors newPasswordField in lib/shared/schemas.ts. */
const RULES = "At least 10 characters, including a letter and a number.";

export function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function reset() {
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setFieldErrors({});
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await changePassword({
        currentPassword,
        password,
        confirmPassword,
      });
      if (!res.ok) {
        setError(res.fieldErrors ? null : res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      reset();
      setOpen(false);
      toast.success("Password changed.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Password</CardTitle>
        <CardDescription>
          The password you use to log in to MathDOC.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Change password
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="max-w-sm space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                invalid={Boolean(fieldErrors.currentPassword)}
                autoFocus
              />
              {fieldErrors.currentPassword && (
                <p className="text-sm text-destructive">
                  {fieldErrors.currentPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password ? (
                <p className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{RULES}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmNewPassword"
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

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save new password"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
