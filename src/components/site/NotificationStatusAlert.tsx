"use client";

import { Button } from "@/components/ui/button";
import { subscribeToPush } from "@/lib/client/push";
import {
  useNotificationPermission,
  useRequestNotificationPermission,
} from "@/lib/client/browser";
import { toast } from "sonner";
import { BellOff, Bell } from "lucide-react";

/**
 * Persistent reminder on the profile page shown when the student has blocked
 * browser notifications. The button re-asks for permission; once a browser is
 * hard-blocked it can't re-prompt, so we then point them to site settings.
 */
export function NotificationStatusAlert() {
  // Subscribed, not read once on mount: if the student unblocks notifications
  // in browser settings and returns to the tab, this alert now disappears by
  // itself instead of lingering until a reload.
  const permission = useNotificationPermission();
  const requestPermission = useRequestNotificationPermission();

  async function enable() {
    const result = await requestPermission();
    if (result === "granted") {
      toast.success("Notifications on — you're all set.");
      subscribeToPush();
    } else if (result !== "unsupported") {
      toast(
        "Notifications are still blocked. Turn them on from your browser's site settings (tap the padlock next to the address bar)."
      );
    }
  }

  if (permission !== "denied") return null;

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <BellOff className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-destructive">Notifications are turned off</p>
        <p className="text-muted-foreground">
          You won&apos;t get alerts for new tasks, reviews or replies. Turn them
          back on to stay updated.
        </p>
      </div>
      <Button size="sm" onClick={enable} className="shrink-0">
        <Bell className="size-4" /> Enable notifications
      </Button>
    </div>
  );
}
