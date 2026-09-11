import "server-only";
import { headers } from "next/headers";
import { createSupabaseAdmin } from "./supabase-admin";

/**
 * Rate limiting, backed by a shared Postgres counter.
 *
 * WHY NOT IN-MEMORY: this used to count hits in a module-level Map. On a single
 * long-lived server that is correct, but on Vercel every concurrent lambda
 * instance has its OWN Map and cold starts reset it. Requests spread across
 * instances each got a fresh budget, so the OTP-flood and admin-login limits
 * were far weaker than they looked. `check_rate_limit()` (migration 019) does
 * the count in one atomic upsert that every instance shares.
 *
 * The in-memory map is kept as a FALLBACK for when the database call fails, so
 * a transient Supabase blip degrades the limiter rather than removing it (or
 * taking login down). It is per-instance and therefore weaker, which is exactly
 * why it is the fallback and not the primary.
 */

type LimiterName =
  | "signup" // new account creation
  | "password_reset" // "email me a reset link"
  | "login" // password attempts (student and admin)
  | "form" // profile save, survey submit, review actions...
  | "booking" // slot booking + payment bypass
  | "upload" // presign requests
  | "chat" // task messages
  | "push" // push-subscription registration
  | "public_page"; // invoice / certificate pages per IP

const configs: Record<LimiterName, { requests: number; windowMs: number }> = {
  // Per IP this is generous enough for a family sharing a connection and mean
  // enough to stop a script filling the table with junk accounts.
  signup: { requests: 5, windowMs: 60 * 60_000 },
  // Each one sends mail on our quota, and a flood is also a way to harass
  // somebody's inbox, so it is the tightest of the three.
  password_reset: { requests: 4, windowMs: 60 * 60_000 },
  login: { requests: 8, windowMs: 15 * 60_000 },
  form: { requests: 30, windowMs: 10 * 60_000 },
  booking: { requests: 10, windowMs: 10 * 60_000 },
  upload: { requests: 30, windowMs: 10 * 60_000 },
  chat: { requests: 40, windowMs: 10 * 60_000 },
  push: { requests: 10, windowMs: 10 * 60_000 },
  public_page: { requests: 60, windowMs: 10 * 60_000 },
};

// Fallback store only. key -> timestamps of recent hits (pruned on every check)
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

/**
 * Best-effort client IP for rate limiting.
 *
 * SECURITY: `x-forwarded-for` is a client-settable header. Reading its FIRST
 * entry lets anyone send `X-Forwarded-For: <random>` and get a brand-new
 * rate-limit bucket per request, which silently defeats OTP-flood and
 * admin-login brute-force protection.
 *
 * Trust order:
 *  1. Platform headers that the edge sets itself and strips from client input
 *     (Vercel / Cloudflare). These are authoritative when present.
 *  2. The RIGHTMOST x-forwarded-for entry — appended by the closest proxy, so
 *     it is the only entry a client cannot forge. Anything the client sends is
 *     pushed leftwards and ignored.
 *
 * If you deploy behind N trusted proxies, take the Nth-from-right entry
 * instead; with a single proxy (Vercel) the rightmost is correct.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();

  const platform =
    h.get("x-vercel-forwarded-for") ?? h.get("cf-connecting-ip");
  if (platform) return platform.trim();

  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return h.get("x-real-ip")?.trim() || "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  /** Friendly message to show the user when blocked. */
  message?: string;
}

function blockedMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Please wait ${minutes} minute${
    minutes === 1 ? "" : "s"
  } and try again.`;
}

/**
 * Check a rate limit. `key` should identify the actor: a phone number,
 * user id, or IP address.
 */
export async function rateLimit(
  name: LimiterName,
  key: string
): Promise<RateLimitResult> {
  const { requests, windowMs } = configs[name];
  const mapKey = `${name}:${key}`;

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: mapKey,
      p_limit: requests,
      p_window_seconds: Math.round(windowMs / 1000),
    });
    if (error) throw error;

    // The function returns a single row.
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; retry_after_seconds: number }
      | undefined;
    if (!row) throw new Error("check_rate_limit returned no row");

    return row.allowed
      ? { allowed: true }
      : { allowed: false, message: blockedMessage(row.retry_after_seconds) };
  } catch (err) {
    console.error(
      `Rate limit DB check failed for "${name}" — falling back to the ` +
        `per-instance limiter (weaker). Did migration 019 run?`,
      err
    );
    return memoryRateLimit(mapKey, requests, windowMs);
  }
}

/** Per-instance fallback. Only reached when the shared counter is unavailable. */
function memoryRateLimit(
  mapKey: string,
  requests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  const recent = (hits.get(mapKey) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= requests) {
    hits.set(mapKey, recent);
    const oldest = recent[0];
    return {
      allowed: false,
      message: blockedMessage((oldest + windowMs - now) / 1000),
    };
  }

  recent.push(now);
  hits.set(mapKey, recent);

  // Basic memory guard: drop the oldest entries if the map grows too large.
  if (hits.size > MAX_KEYS) {
    for (const k of hits.keys()) {
      hits.delete(k);
      if (hits.size <= MAX_KEYS / 2) break;
    }
  }
  return { allowed: true };
}
