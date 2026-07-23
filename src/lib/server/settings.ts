import "server-only";
import { createSupabaseAdmin } from "./supabase-admin";

/**
 * Admin-managed key/value settings (see the `settings` table). Reads/writes go
 * through the service role so they work in any server context; the admin
 * Settings actions gate who may change them.
 */
export async function getSetting(key: string): Promise<string | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const admin = createSupabaseAdmin();
  await admin.from("settings").upsert({ key, value }, { onConflict: "key" });
}

/** Whether the pricing/payment step is active. Off by default. */
export async function getPaymentsEnabled(): Promise<boolean> {
  return (await getSetting("payments_enabled")) === "true";
}
