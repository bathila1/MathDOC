"use client";

import { savePushSubscription } from "@/features/notifications/server/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  // Back it with a real ArrayBuffer so it satisfies BufferSource (TS 5.7+).
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function uint8ArrayToUrlBase64(buf: ArrayBuffer) {
  let raw = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * True when an existing subscription was created with a different VAPID key
 * than we're signing with now. The push service binds the key to the endpoint,
 * so a rotated key makes every send fail 401 until the browser re-subscribes.
 */
function isStale(sub: PushSubscription): boolean {
  const key = sub.options?.applicationServerKey;
  // Older browsers don't expose options — assume current rather than churn.
  if (!key) return false;
  return uint8ArrayToUrlBase64(key) !== VAPID_PUBLIC_KEY;
}

/**
 * Register the service worker and subscribe this browser to Web Push, then
 * persist the subscription server-side. Idempotent and best-effort — safe to
 * call on every page load and right after the user grants permission.
 */
export async function subscribeToPush(): Promise<void> {
  if (typeof window === "undefined") return;
  // Each bail-out says why: these used to be silent, which is how a rotated
  // VAPID key went unnoticed for days.
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn(
      "[push] unavailable: no service worker / PushManager. Needs a secure " +
        "context (https or localhost).",
      { secureContext: window.isSecureContext, origin: location.origin }
    );
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    console.warn(
      "[push] skipped: notification permission is",
      "Notification" in window ? Notification.permission : "unsupported"
    );
    return;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn(
      "[push] skipped: NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from the " +
        "client bundle. Set it and restart the dev server."
    );
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    // Drop a subscription bound to a superseded VAPID key, else we'd keep
    // handing the server an endpoint every send 401s on, forever.
    if (sub && isStale(sub)) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.warn("[push] subscription is missing endpoint/keys", json);
      return;
    }
    const res = await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    // The action swallows DB errors into a result object, so surface it here
    // rather than assuming the row landed.
    if (!res.ok) console.warn("[push] server rejected the subscription:", res);
  } catch (e) {
    // Best-effort, but stay diagnosable: a silent failure here is why a
    // rotated VAPID key went unnoticed.
    console.warn("Push subscription failed:", e);
  }
}
