import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

/**
 * Upstash-backed rate limiting for every client-facing mutation.
 * Without Upstash env vars (local dev) it becomes a no-op with a console warning.
 */

type LimiterName =
  | "otp" // OTP request: strict — 3 per 15 min per phone
  | "otp_verify" // code entry attempts
  | "login" // admin email+password attempts
  | "form" // profile save, MCQ submit, review actions...
  | "booking" // slot booking + payment bypass
  | "upload" // presign requests
  | "public_page"; // invoice / certificate token pages per IP

const configs: Record<LimiterName, { requests: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  otp: { requests: 3, window: "15 m" },
  otp_verify: { requests: 8, window: "15 m" },
  login: { requests: 8, window: "15 m" },
  form: { requests: 30, window: "10 m" },
  booking: { requests: 10, window: "10 m" },
  upload: { requests: 30, window: "10 m" },
  public_page: { requests: 60, window: "10 m" },
};

const limiters = new Map<LimiterName, Ratelimit>();
let warned = false;

function upstashConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getLimiter(name: LimiterName): Ratelimit | null {
  if (!upstashConfigured()) {
    if (!warned) {
      console.warn("[ratelimit] Upstash env vars missing — rate limiting DISABLED (dev only).");
      warned = true;
    }
    return null;
  }
  let limiter = limiters.get(name);
  if (!limiter) {
    const cfg = configs[name];
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window),
      prefix: `mathdoc:rl:${name}`,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

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
  const limiter = getLimiter(name);
  if (!limiter) return { allowed: true };

  const { success, reset } = await limiter.limit(key);
  if (success) return { allowed: true };

  const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60000));
  return {
    allowed: false,
    message: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
  };
}
