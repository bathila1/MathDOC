import "server-only";
import webpush from "web-push";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) {
    // Don't cache the failure — env may load on a later request (dev restart).
    console.warn("Web Push disabled: VAPID keys are not set.");
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string | null;
  tag?: string;
}

/**
 * Send a Web Push message to every device the given users subscribed with.
 * Best-effort: missing VAPID config is a no-op, and dead endpoints (404/410)
 * are pruned so they aren't retried.
 */
export async function sendPush(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (userIds.length === 0 || !ensureConfigured()) return;

  const admin = createSupabaseAdmin();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/",
    tag: payload.tag,
  });

  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id as string);
        else console.error("web push send failed:", status, (e as Error).message);
      }
    })
  );

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }
}
