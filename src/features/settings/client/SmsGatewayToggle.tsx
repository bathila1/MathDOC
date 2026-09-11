"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSmsEnabled } from "@/features/settings/server/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Flips the "sms_enabled" setting. While off, `sendSms()` returns without
 * calling Hutch at all — booking confirmations and certificate links simply
 * aren't texted, and nothing else changes.
 */
export function SmsGatewayToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setSmsEnabled(next);
      if (!res.ok) {
        setOn(!next); // revert
        toast.error(res.error);
        return;
      }
      toast.success(
        next
          ? "SMS turned on — messages will be sent through Hutch again."
          : "SMS turned off — no messages will be sent."
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
        aria-label="Send SMS messages"
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
        {on ? "SMS on" : "SMS off"}
      </span>
    </div>
  );
}
