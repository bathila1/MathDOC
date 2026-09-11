"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

/**
 * Password box with a reveal toggle.
 *
 * Worth the extra control: the strength rules ask for 10+ characters, and
 * typing that blind on a phone keyboard is where people give up and pick
 * something short instead. The button is `tabIndex={-1}` so tabbing still runs
 * straight from the field to the submit button.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** "new-password" on signup/reset, "current-password" on login. */
  autoComplete: string;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        className="pr-12"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground"
      >
        {shown ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
