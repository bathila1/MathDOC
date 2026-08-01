"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/client/supabase";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { subscribeToPush } from "@/lib/client/push";
import { toast } from "sonner";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { AppNotification } from "@/lib/shared/types";

/**
 * Bell + slide-in panel for a user's notifications. Loads recent ones, then
 * listens over Supabase Realtime (RLS keeps each client to its own rows). New
 * arrivals bump the unread badge and — if the tab is in the background and the
 * user has granted permission — pop a native browser notification.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowser());
  // Unique per mount: the bell renders in two places (mobile header + desktop
  // bar), and reusing one channel topic makes Realtime reject the second
  // subscriber ("cannot add callbacks after subscribe()"). A per-instance topic
  // keeps each bell (and dev Strict-Mode remounts) on its own channel.
  const [topic] = useState(
    () => `notifications-${userId}-${Math.random().toString(36).slice(2, 8)}`
  );
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  const announce = useCallback(
    (n: AppNotification) => {
      if (typeof window === "undefined") return;
      // When notifications are granted, the service worker / Web Push shows the
      // real OS notification — so we don't also pop an in-app toast (no dupes).
      // Only when push isn't available do we surface an in-app toast.
      if ("Notification" in window && Notification.permission === "granted") return;
      toast(n.title, {
        description: n.body ?? undefined,
        action: n.link
          ? { label: "View", onClick: () => router.push(n.link!) }
          : undefined,
      });
    },
    [router]
  );

  useEffect(() => {
    let active = true;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (active && data) setItems(data as AppNotification[]);
      });

    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) =>
            prev.some((x) => x.id === n.id) ? prev : [n, ...prev]
          );
          announce(n);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, topic, announce]);

  async function markAllRead() {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  }

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    if (n.link) router.push(n.link);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Ask for native-notification permission on first open (a user gesture).
    if (
      next &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission()
        .then((p) => {
          if (p === "granted") subscribeToPush();
        })
        .catch(() => {});
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            className="relative inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b p-4">
          <SheetTitle>Notifications</SheetTitle>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <Check className="size-4" /> Mark all read
            </Button>
          )}
        </div>
        <div className="overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      "flex w-full gap-3 p-4 text-left text-sm transition-colors hover:bg-muted/50",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-primary"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{n.title}</span>
                      {n.body && (
                        <span className="mt-0.5 block text-muted-foreground">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
