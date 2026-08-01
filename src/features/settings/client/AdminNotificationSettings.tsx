"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAdminNotifyPref } from "@/features/settings/server/actions";
import { ADMIN_NOTIFY_TYPES } from "@/lib/shared/notifications";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Toggles for which admin-side notifications the teacher receives. */
export function AdminNotificationSettings({
  prefs,
}: {
  prefs: Record<string, boolean>;
}) {
  const router = useRouter();
  const [state, setState] = useState(prefs);
  const [pending, startTransition] = useTransition();

  function toggle(type: string) {
    const next = !(state[type] ?? true);
    setState((s) => ({ ...s, [type]: next })); // optimistic
    startTransition(async () => {
      const res = await setAdminNotifyPref({ type, enabled: next });
      if (!res.ok) {
        setState((s) => ({ ...s, [type]: !next })); // revert
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <ul className="divide-y divide-border/60">
      {ADMIN_NOTIFY_TYPES.map((t) => {
        const on = state[t.key] ?? true;
        return (
          <li key={t.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={t.label}
              disabled={pending}
              onClick={() => toggle(t.key)}
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
          </li>
        );
      })}
    </ul>
  );
}
