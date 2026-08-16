"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/features/students/server/actions";
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
import { Textarea } from "@/components/ui/textarea";

export const PROFILE_FIELDS = [
  { name: "full_name", label: "Full name", placeholder: "A. B. Perera" },
  { name: "school", label: "School", placeholder: "Your school" },
  { name: "grade", label: "Grade / Year", placeholder: "Grade 11" },
  { name: "guardian_name", label: "Parent / guardian name", placeholder: "" },
  {
    name: "guardian_phone",
    label: "Parent / guardian phone",
    placeholder: "0771234567",
  },
] as const;

export type ProfileValues = Partial<
  Record<(typeof PROFILE_FIELDS)[number]["name"] | "address", string | null>
>;

export function ProfileForm({
  initial,
  mode = "register",
  withCard = true,
  onSaved,
  onCancel,
}: {
  initial?: ProfileValues;
  mode?: "register" | "edit";
  /** false renders just the fields, for embedding in an existing card */
  withCard?: boolean;
  /** when given, saving stays on the page instead of navigating away */
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const [k, val] of Object.entries(initial ?? {})) {
      if (val) v[k] = val;
    }
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setTopError(null);
    startTransition(async () => {
      const res = await saveProfile(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setTopError(res.fieldErrors ? null : res.error);
        return;
      }
      router.refresh();
      if (onSaved) {
        onSaved(); // inline editing — stay where we are
        return;
      }
      router.push(mode === "edit" ? "/student/profile" : res.data.next);
    });
  }

  const body = (
    <form onSubmit={onSubmit} className="space-y-4">
      {PROFILE_FIELDS.map((f) => (
        <div key={f.name} className="space-y-2">
          <Label htmlFor={f.name}>
            {f.label} <span aria-hidden className="text-destructive">*</span>
          </Label>
          <Input
            id={f.name}
            required
            aria-required="true"
            placeholder={f.placeholder}
            value={values[f.name] ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
          />
          {errors[f.name] && (
            <p className="text-sm text-destructive">{errors[f.name]}</p>
          )}
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor="address">
          Home address <span aria-hidden className="text-destructive">*</span>
        </Label>
        <Textarea
          id="address"
          rows={2}
          required
          aria-required="true"
          value={values.address ?? ""}
          onChange={(e) => set("address", e.target.value)}
        />
        {errors.address && (
          <p className="text-sm text-destructive">{errors.address}</p>
        )}
      </div>
      {topError && <p className="text-sm text-destructive">{topError}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Finish and go to my plan"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>

    </form>
  );

  if (!withCard) return body;

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle className="text-xl">Tell us about yourself</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
