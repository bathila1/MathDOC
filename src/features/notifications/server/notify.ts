import "server-only";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getSetting } from "@/lib/server/settings";
import { adminNotifyKey } from "@/lib/shared/notifications";
import { sendPush } from "./push";

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Insert one or more notifications (service role). Best-effort: notifications
 * must never break the action that triggered them, so failures are only logged.
 */
export async function notify(input: NotifyInput | NotifyInput[]): Promise<void> {
  const list = Array.isArray(input) ? input : [input];
  if (list.length === 0) return;
  try {
    const admin = createSupabaseAdmin();
    const { error } = await admin.from("notifications").insert(
      list.map((n) => ({
        user_id: n.userId,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
      }))
    );
    if (error) console.error("notify insert failed:", error.message);
  } catch (e) {
    console.error("notify failed:", e);
  }

  // Fan out as browser push too (works even when the site is closed).
  await Promise.all(
    list.map((n) =>
      sendPush([n.userId], { title: n.title, body: n.body, url: n.link })
    )
  );
}

/** Recipient ids of every admin (usually just the one teacher). */
export async function adminIds(): Promise<string[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    return (data ?? []).map((r) => r.id as string);
  } catch {
    return [];
  }
}

/** Notify every admin with the same payload, unless disabled in the control
 *  centre (Settings → Notification control centre). Defaults to on. */
export async function notifyAdmins(
  payload: Omit<NotifyInput, "userId">
): Promise<void> {
  if ((await getSetting(adminNotifyKey(payload.type))) === "false") return;
  const ids = await adminIds();
  await notify(ids.map((id) => ({ ...payload, userId: id })));
}
