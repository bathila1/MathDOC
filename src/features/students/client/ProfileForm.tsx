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

const fields = [
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

export function ProfileForm({
  initial,
  mode = "register",
}: {
  initial?: Partial<Record<(typeof fields)[number]["name"] | "address", string | null>>;
  mode?: "register" | "edit";
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
      router.push(mode === "edit" ? "/student/profile" : "/student/exam");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">Tell us about yourself</CardTitle>
        <CardDescription>
          Sir uses these details to prepare for your sessions. Everything is
          optional — fill what you like, you can come back later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name} className="space-y-2">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input
                id={f.name}
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
            <Label htmlFor="address">Home address</Label>
            <Textarea
              id="address"
              rows={2}
              value={values.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address}</p>
            )}
          </div>
          {topError && <p className="text-sm text-destructive">{topError}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? "Saving…"
              : mode === "edit"
                ? "Save changes"
                : "Continue to the quiz"}
          </Button>
          {mode === "register" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setErrors({});
                setTopError(null);
                startTransition(async () => {
                  const res = await saveProfile({});
                  if (!res.ok) {
                    setTopError(res.error);
                    return;
                  }
                  router.push("/student/exam");
                  router.refresh();
                });
              }}
            >
              Skip for now
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
