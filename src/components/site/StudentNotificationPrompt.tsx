"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";

type Perm = "default" | "granted" | "denied" | "unsupported";

/**
 * Asks students to allow browser notifications. If they block them, it nags once
 * (per session) explaining why they matter; the persistent reminder then lives
 * on the profile page (see NotificationStatusAlert).
 */
export function StudentNotificationPrompt() {
  const [perm, setPerm] = useState<Perm | null>(null);
  const [open, setOpen] = useState(false);
  const [nag, setNag] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    const p = Notification.permission as Perm;
    setPerm(p);
    const dismissed = sessionStorage.getItem("notif-prompt-dismissed");
    if (p === "default") setOpen(true);
    else if (p === "denied" && !dismissed) {
      setNag(true);
      setOpen(true);
    }
  }, []);

  async function enable() {
    try {
      const result = (await Notification.requestPermission()) as Perm;
      setPerm(result);
      if (result === "granted") {
        toast.success("Notifications on — you won't miss Sir's updates.");
        setOpen(false);
        subscribeToPush();
      } else {
        setNag(true); // denied → show the nag
      }
    } catch {
      setNag(true);
    }
  }

  function dismiss() {
    sessionStorage.setItem("notif-prompt-dismissed", "1");
    setOpen(false);
  }

  if (perm === "granted" || perm === "unsupported" || perm === null) return null;

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
