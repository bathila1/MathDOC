"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Browser state read through `useSyncExternalStore` rather than
 * `useEffect(() => setState(...), [])`.
 *
 * The effect version renders once with a placeholder, then immediately renders
 * again — and, worse, never notices when the value changes afterwards. These
 * subscribe properly, so a permission the user flips in browser settings is
 * picked up without a page reload.
 */

/** Nothing to subscribe to: hydration happens exactly once. */
const noopSubscribe = () => () => {};

/**
 * `false` while server-rendering and during hydration, `true` afterwards.
 * Use to gate anything that would otherwise cause a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

function getPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Everyone currently subscribed to the permission store.
 *
 * The Permissions API is the ideal signal but is not universally available for
 * "notifications" (Safari rejects the query), so this registry is what
 * guarantees the UI updates after WE prompt — see requestPermission below.
 * Without it, granting permission on Safari would leave the prompt on screen.
 */
const permissionListeners = new Set<() => void>();

function emitPermissionChange() {
  for (const fn of permissionListeners) fn();
}

/**
 * Subscribes via the Permissions API so a change made in the browser's own site
 * settings updates the UI live. `Notification.permission` itself has no change
 * event, and the query is async, so the listener is attached once it resolves —
 * `useSyncExternalStore` allows that as long as unsubscribe stays synchronous.
 */
function subscribePermission(onChange: () => void): () => void {
  permissionListeners.add(onChange);

  let status: PermissionStatus | null = null;
  let cancelled = false;

  if (typeof navigator !== "undefined" && navigator.permissions) {
    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        s.addEventListener("change", onChange);
      })
      .catch(() => {
        // Safari and older browsers reject for "notifications" — the initial
        // snapshot is still correct, and our own prompt still notifies.
      });
  }

  return () => {
    cancelled = true;
    permissionListeners.delete(onChange);
    status?.removeEventListener("change", onChange);
  };
}

/** Current notification permission; "unsupported" on the server. */
export function useNotificationPermission(): NotificationPermissionState {
  return useSyncExternalStore(
    subscribePermission,
    getPermission,
    () => "unsupported" as const
  );
}

/**
 * Ask for notification permission. Returns the resulting state; subscribers are
 * notified explicitly so the UI updates even where the Permissions API can't
 * tell us, rather than relying on it having fired.
 */
export function useRequestNotificationPermission() {
  return useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    try {
      const result =
        (await Notification.requestPermission()) as NotificationPermissionState;
      emitPermissionChange();
      return result;
    } catch {
      emitPermissionChange();
      return getPermission();
    }
  }, []);
}
