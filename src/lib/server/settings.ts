import "server-only";
import { cache } from "react";
import { createSupabaseAdmin } from "./supabase-admin";

/**
 * Admin-managed key/value settings (see the `settings` table). Reads/writes go
 * through the service role so they work in any server context; the admin
 * Settings actions gate who may change them.
 *
 * THE WHOLE TABLE IS READ AT ONCE, and only once per request.
 *
 * It used to be a query per key. That is invisible locally and expensive in
 * production, where each round-trip to Supabase costs 100ms+ and they add up
 * per page: the Settings page alone fired nine — one for payments, one for
 * SMS, one for debug errors, and one for each of the five notification
 * preferences. The table holds a handful of tiny rows, so fetching all of them
 * costs the same as fetching one, and every caller in the request then reads
 * from memory.
 *
 * Staleness: `cache()` lives for a single request. A write followed by a read
 * in the SAME request would see the old value — no caller does that, and every
 * setter calls revalidatePath so the next render re-reads.
 */
const allSettings = cache(async (): Promise<Map<string, string>> => {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("settings").select("key, value");
  if (error) {
    // Fail soft: callers fall back to their defaults rather than the page
    // dying because one preference could not be read.
    console.error("Could not read settings:", error.message);
    return new Map();
  }
  return new Map(
    (data as { key: string; value: string }[] | null)?.map((r) => [
      r.key,
      r.value,
    ]) ?? []
  );
});

export async function getSetting(key: string): Promise<string | null> {
  return (await allSettings()).get(key) ?? null;
}

/** Several at once, from the same single read. */
export async function getSettings(
  keys: readonly string[]
): Promise<Map<string, string>> {
  const all = await allSettings();
  return new Map(
    keys.flatMap((k) => {
      const v = all.get(k);
      return v === undefined ? [] : [[k, v] as [string, string]];
    })
  );
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
