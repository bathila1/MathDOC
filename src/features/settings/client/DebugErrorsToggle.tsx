"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDebugErrors } from "@/features/settings/server/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Flips the "debug_errors" setting. While on, login and SMS failures report
 * the underlying fault instead of a friendly summary — see the warning in the
 * Settings card: those messages reach anyone on the public login page, so this
 * is a diagnostic to switch on, read, and switch back off.
 */
export function DebugErrorsToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setDebugErrors(next);
      if (!res.ok) {
        setOn(!next); // revert
        toast.error(res.error);
        return;
      }
      toast.success(
        next
          ? "Debug errors on — exact failures are now shown to visitors."
          : "Debug errors off — visitors see the friendly messages again."
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Show detailed error messages"
        disabled={pending}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
          on ? "bg-destructive" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-background shadow transition-transform",
            on ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      <span className="text-sm font-medium">
        {on ? "Debug errors on" : "Debug errors off"}
      </span>
    </div>
  );
}
