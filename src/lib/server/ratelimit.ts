import "server-only";
import { headers } from "next/headers";

/**
 * Simple in-memory sliding-window rate limiter — no external service needed.
 * Good enough for a single-server deployment. If the app later runs on
 * serverless (Vercel) at scale, swap the store for Upstash Redis; every
 * call site already goes through this one rateLimit() function.
 */

type LimiterName =
  | "otp" // OTP request: strict — per phone
  | "otp_verify" // code entry attempts
  | "login" // admin password attempts
  | "form" // profile save, MCQ submit, review actions...
  | "booking" // slot booking + payment bypass
  | "upload" // presign requests
  | "public_page"; // invoice / certificate pages per IP

const configs: Record<LimiterName, { requests: number; windowMs: number }> = {
  otp: { requests: 3, windowMs: 15 * 60_000 },
  otp_verify: { requests: 8, windowMs: 15 * 60_000 },
  login: { requests: 8, windowMs: 15 * 60_000 },
  form: { requests: 30, windowMs: 10 * 60_000 },
  booking: { requests: 10, windowMs: 10 * 60_000 },
  upload: { requests: 30, windowMs: 10 * 60_000 },
  public_page: { requests: 60, windowMs: 10 * 60_000 },
};

// key -> timestamps of recent hits (pruned on every check)
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export interface RateLimitResult {
  allowed: boolean;
  /** Friendly message to show the user when blocked. */
  message?: string;
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
  const now = Date.now();
  const mapKey = `${name}:${key}`;

  const recent = (hits.get(mapKey) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= requests) {
    hits.set(mapKey, recent);
    const oldest = recent[0];
    const minutes = Math.max(1, Math.ceil((oldest + windowMs - now) / 60_000));
    return {
      allowed: false,
      message: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
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
