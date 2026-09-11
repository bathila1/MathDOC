import "server-only";
import { toMsisdn } from "@/lib/shared/phone";
import { getSmsEnabled } from "@/lib/server/settings";

/**
 * Hutch Bulk SMS gateway (https://bsms.hutch.lk) — OAuth 2.0.
 *
 * Used for login OTP codes (via the Supabase Send-SMS auth hook), booking
 * confirmations, and certificate links.
 *
 * Flow, per Hutch's integration guide:
 *   POST /api/login              {username,password} -> {accessToken, refreshToken}
 *   GET  /api/token/accessToken  Bearer <refreshToken> -> {accessToken}
 *   POST /api/sendsms            Bearer <accessToken>  -> {serverRef}
 * A 401 from send means the access token expired: renew and retry once. A 401
 * from renew means the refresh token expired: log in again and retry once.
 *
 * There is NO simulated fallback. If credentials are missing or the gateway
 * refuses, sending FAILS — a silent "pretend it sent" would let a student
 * believe an OTP is on its way that will never arrive.
 */

const DEFAULT_BASE_URL = "https://bsms.hutch.lk/api";
const REQUEST_TIMEOUT_MS = 15_000;
/** Renew slightly before real expiry so a send never races the clock. */
const EXPIRY_SKEW_MS = 30_000;
/** Hutch rejects longer content; keep well under a concatenated-SMS limit. */
const MAX_CONTENT_LENGTH = 1000;

function baseUrl(): string {
  return (process.env.HUTCH_SMS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** True when every Hutch credential is present. */
export function smsConfigured(): boolean {
  return Boolean(
    process.env.HUTCH_SMS_USERNAME &&
      process.env.HUTCH_SMS_PASSWORD &&
      process.env.HUTCH_SMS_MASK
  );
}

/** Mask a number for logs — never write a full subscriber number to disk. */
function maskNumber(msisdn: string): string {
  return msisdn.length <= 6
    ? "***"
    : `${msisdn.slice(0, 4)}***${msisdn.slice(-3)}`;
}

const jsonHeaders = {
  "Content-Type": "application/json",
  Accept: "*/*",
  "X-API-VERSION": "v1",
} as const;

/** Every gateway call shares one timeout so a hung Hutch can't stall a request. */
async function hutchFetch(
  path: string,
  init: RequestInit & { bearer?: string }
): Promise<Response> {
  const { bearer, ...rest } = init;
  return fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: {
      ...jsonHeaders,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(rest.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
}

// ---------------- token cache ----------------

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token stops being usable. */
  accessExpiresAt: number;
}

/**
 * The two ways authenticating to Hutch can fail, kept apart because only one
 * of them is an operator's problem to fix.
 */
type AuthFailure = Extract<SendSmsFailure, "gateway_auth" | "gateway_rejected">;

type AuthAttempt =
  | { tokens: TokenSet; error?: undefined }
  | { tokens?: undefined; error: AuthFailure };

// Module-scoped: one process reuses tokens instead of logging in per message.
// Serverless cold starts simply log in again, which is correct but slower.
let tokens: TokenSet | null = null;
// Single-flight guard: a burst of sends must not fire N concurrent logins
// against the customer's account (which can look like credential stuffing).
let authInFlight: Promise<AuthAttempt> | null = null;

/**
 * Read `exp` out of a JWT to schedule renewal. This is OUR token from Hutch —
 * we are not making a trust decision on it, only deciding when to refresh, so
 * decoding without verification is fine. Falls back to a conservative 5
 * minutes if the token isn't a readable JWT.
 */
function expiryFromJwt(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const exp = JSON.parse(json).exp;
    if (typeof exp === "number") return exp * 1000;
  } catch {
    /* fall through */
  }
  return Date.now() + 5 * 60_000;
}

async function login(): Promise<AuthAttempt> {
  const username = process.env.HUTCH_SMS_USERNAME;
  const password = process.env.HUTCH_SMS_PASSWORD;
  if (!username || !password) return { error: "gateway_auth" };

  const res = await hutchFetch("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    // Deliberately does not echo the response body or the credentials.
    console.error(`Hutch SMS login failed: HTTP ${res.status}`);
    // 401/403 means the account itself is the problem — wrong password,
    // expired, or suspended — and no retry will help until someone rotates
    // the credentials. Any other status is Hutch being unwell, which is worth
    // telling apart so we don't send an operator chasing a password that was
    // never wrong.
    return {
      error:
        res.status === 401 || res.status === 403
          ? "gateway_auth"
          : "gateway_rejected",
    };
  }

  const data = (await res.json().catch(() => null)) as {
    accessToken?: string;
    refreshToken?: string;
  } | null;
  if (!data?.accessToken || !data?.refreshToken) {
    console.error("Hutch SMS login returned no tokens.");
    return { error: "gateway_auth" };
  }

  return {
    tokens: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessExpiresAt: expiryFromJwt(data.accessToken),
    },
  };
}

/** Renew the access token with the refresh token; null means "log in again". */
async function renew(refreshToken: string): Promise<TokenSet | null> {
  const res = await hutchFetch("/token/accessToken", {
    method: "GET",
    bearer: refreshToken,
  });

  if (res.status === 401) return null; // refresh token expired
  if (!res.ok) {
    console.error(`Hutch SMS token renew failed: HTTP ${res.status}`);
    return null;
  }

  const data = (await res.json().catch(() => null)) as {
    accessToken?: string;
  } | null;
  if (!data?.accessToken) return null;

  return {
    accessToken: data.accessToken,
    refreshToken,
    accessExpiresAt: expiryFromJwt(data.accessToken),
  };
}

type TokenResult =
  | { token: string; error?: undefined }
  | { token?: undefined; error: AuthFailure };

/** Current access token, renewing or logging in as needed. */
async function getAccessToken(forceRefresh = false): Promise<TokenResult> {
  if (
    !forceRefresh &&
    tokens &&
    Date.now() < tokens.accessExpiresAt - EXPIRY_SKEW_MS
  ) {
    return { token: tokens.accessToken };
  }

  // Coalesce concurrent callers onto one login/renew.
  if (!authInFlight) {
    authInFlight = (async () => {
      if (tokens?.refreshToken) {
        const renewed = await renew(tokens.refreshToken);
        if (renewed) return { tokens: renewed };
      }
      return login();
    })().finally(() => {
      authInFlight = null;
    });
  }

  const attempt = await authInFlight;
  tokens = attempt.tokens ?? null;
  return attempt.tokens
    ? { token: attempt.tokens.accessToken }
    : { error: attempt.error };
}

// ---------------- sending ----------------

/**
 * Why a send failed. Callers map this to a message for their own audience —
 * the same failure is a log line for a booking confirmation but a blocking
 * error on the login form.
 */
export type SendSmsFailure =
  /** Switched off by the teacher in Admin → Settings. Not a fault. */
  | "disabled"
  /** HUTCH_SMS_* missing from the environment. */
  | "not_configured"
  /** Hutch refused our account credentials. */
  | "gateway_auth"
  /** Not a Sri Lankan mobile in 947XXXXXXXX form. */
  | "bad_number"
  /** Hutch authenticated us but refused the message. */
  | "gateway_rejected"
  /** Timeout or transport failure reaching Hutch. */
  | "network";

export interface SendSmsResult {
  sent: boolean;
  error?: string;
  /** Absent when `sent` is true. */
  reason?: SendSmsFailure;
  /** Hutch's reference for a delivered message, useful for support tickets. */
  serverRef?: number;
}

/**
 * Send one SMS through Hutch.
 *
 * `phoneE164` is the stored "+947XXXXXXXX" form; Hutch wants "947XXXXXXXX".
 * `campaign` groups messages in Hutch's reporting UI.
 *
 * Errors are logged server-side with the number masked, and the caller gets a
 * generic message — gateway responses can carry account detail we don't want
 * surfacing in a UI.
 */
export async function sendSms(
  phoneE164: string,
  message: string,
  campaign = "MathDOC"
): Promise<SendSmsResult> {
  // Checked before anything else, including the credential check: when the
  // teacher has switched sending off this is an expected state, so it must not
  // spend a 15-second gateway timeout or write an error to the log.
  if (!(await getSmsEnabled())) {
    console.info("SMS not sent: sending is switched off in Admin → Settings.");
    return {
      sent: false,
      reason: "disabled",
      error: "SMS sending is switched off.",
    };
  }

  if (!smsConfigured()) {
    console.error(
      "SMS not sent: Hutch credentials are missing (HUTCH_SMS_USERNAME / " +
        "HUTCH_SMS_PASSWORD / HUTCH_SMS_MASK)."
    );
    return {
      sent: false,
      reason: "not_configured",
      error: "SMS is not configured.",
    };
  }

  const numbers = toMsisdn(phoneE164);
  if (!/^94\d{9}$/.test(numbers)) {
    console.error(`SMS not sent: bad number format ${maskNumber(numbers)}`);
    return {
      sent: false,
      reason: "bad_number",
      error: "That mobile number looks wrong.",
    };
  }

  const content = message.slice(0, MAX_CONTENT_LENGTH);

  const body = JSON.stringify({
    campaignName: campaign,
    mask: process.env.HUTCH_SMS_MASK,
    numbers,
    content,
  });

  /** Both auth call sites fail the same way; keep the mapping in one place. */
  const authFailed = (error: AuthFailure): SendSmsResult => ({
    sent: false,
    reason: error,
    error:
      error === "gateway_auth"
        ? "The SMS gateway rejected our credentials."
        : "Could not reach the SMS gateway.",
  });

  try {
    const auth = await getAccessToken();
    if (auth.error) return authFailed(auth.error);

    let res = await hutchFetch("/sendsms", {
      method: "POST",
      bearer: auth.token,
      body,
    });

    // Access token expired mid-flight — renew once and retry, per the guide.
    if (res.status === 401) {
      const retry = await getAccessToken(true);
      if (retry.error) return authFailed(retry.error);
      res = await hutchFetch("/sendsms", {
        method: "POST",
        bearer: retry.token,
        body,
      });
    }

    if (!res.ok) {
      // Body is logged, never returned — it can contain account information.
      const detail = await res.text().catch(() => "");
      console.error(
        `Hutch SMS send failed for ${maskNumber(numbers)}: HTTP ${res.status} ${detail.slice(0, 200)}`
      );
      // A 401 that survived the renew-and-retry above is a credential
      // problem, not a bad message — report it as one.
      return {
        sent: false,
        reason: res.status === 401 ? "gateway_auth" : "gateway_rejected",
        error:
          res.status === 401
            ? "The SMS gateway rejected our credentials."
            : "The SMS gateway rejected the message.",
      };
    }

    const data = (await res.json().catch(() => null)) as {
      serverRef?: number;
    } | null;
    return { sent: true, serverRef: data?.serverRef };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    console.error(
      `Hutch SMS request ${timedOut ? "timed out" : "failed"} for ${maskNumber(numbers)}`,
      e
    );
    return {
      sent: false,
      reason: "network",
      error: "Could not reach the SMS gateway.",
    };
  }
}
