"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { subscribeToPush } from "@/lib/client/push";
import {
  useNotificationPermission,
  useRequestNotificationPermission,
} from "@/lib/client/browser";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";

const DISMISS_KEY = "notif-prompt-dismissed";

/**
 * Asks students to allow browser notifications. If they block them, it nags once
 * (per session) explaining why they matter; the persistent reminder then lives
 * on the profile page (see NotificationStatusAlert).
 */
export function StudentNotificationPrompt() {
  const perm = useNotificationPermission();
  const requestPermission = useRequestNotificationPermission();

  // Read once, lazily. On the server this is false, but `perm` is "unsupported"
  // there so nothing renders either way — no hydration mismatch.
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(DISMISS_KEY) === "1"
  );

  // Whether the student actively declined during THIS visit, which switches the
  // dialog from an invitation to an explanation.
  const [justDenied, setJustDenied] = useState(false);

  async function enable() {
    const result = await requestPermission();
    if (result === "granted") {
      toast.success("Notifications on — you won't miss Sir's updates.");
      subscribeToPush();
      return; // `perm` flips to "granted" and the dialog unmounts
    }
    setJustDenied(true);
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (perm === "granted" || perm === "unsupported") return null;
  if (dismissed) return null;

  // Nag only when blocked — either from a previous visit or just now.
  const nag = perm === "denied" || justDenied;
  const open = perm === "default" || nag;
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {nag ? (
              <BellOff className="size-5 text-destructive" />
            ) : (
              <Bell className="size-5 text-primary" />
            )}
            {nag ? "Please turn on notifications" : "Stay in the loop"}
          </DialogTitle>
          <DialogDescription>
            {nag
              ? "Notifications are blocked, so you'll miss Sir's replies, new tasks and reminders. Please allow them in your browser's site settings to stay updated."
              : "Get a heads-up the moment Sir adds a task, reviews your work, or replies to you."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {nag ? (
            <Button onClick={dismiss}>Got it</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={dismiss}>
                Not now
              </Button>
              <Button onClick={enable}>
                <Bell className="size-4" /> Enable notifications
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
