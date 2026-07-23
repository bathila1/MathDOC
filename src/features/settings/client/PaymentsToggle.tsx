"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPaymentsEnabled } from "@/features/settings/server/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Accessible on/off switch (role="switch") — no extra UI dependency. Flips the
 * "payments_enabled" setting; while off, students skip the pricing/payment step.
 */
export function PaymentsToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setPaymentsEnabled(next);
      if (!res.ok) {
        setOn(!next); // revert
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Payments turned on." : "Payments turned off.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Enable payments"
        disabled={pending}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
          on ? "bg-primary" : "bg-muted-foreground/30"
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
        {on ? "Payments on" : "Payments off"}
      </span>
    </div>
  );
}
