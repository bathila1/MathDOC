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

/**
 * Whether the SMS gateway may be called at all.
 *
 * Defaults to ON (`!== "false"`, not `=== "true"`) so an absent row means
 * "behave as before" rather than silently muting every message the day this
 * shipped.
 *
 * The point of the switch is the Hutch outage: while the gateway refuses our
 * credentials every send burns a 15-second timeout and writes an error to the
 * log, which buries real problems. Turning it off makes "we are not texting
 * anyone at the moment" a deliberate, visible state instead of a wall of
 * failures.
 */
export async function getSmsEnabled(): Promise<boolean> {
  return (await getSetting("sms_enabled")) !== "false";
}

/**
 * Whether to report the underlying cause of a failure instead of a friendly
 * summary. Off by default, and deliberately a stored setting rather than an
 * env var: the point is to diagnose a live production fault without a
 * redeploy. These messages surface on the PUBLIC login page, so the Settings
 * card says plainly that it is meant to be switched back off.
 */
export async function getDebugErrorsEnabled(): Promise<boolean> {
  return (await getSetting("debug_errors")) === "true";
}
