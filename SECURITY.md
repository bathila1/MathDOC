# MathDOC — Security Guide

How this app defends itself, what was hardened, and what **you** still need to
do. Read the "Action required" section first — three items there are not
optional.

---

## 1. Action required (do these now)

### 1.1 Rotate the VAPID keys — a private key was committed to git

`.env.example` is tracked by git and contained the **real** `VAPID_PRIVATE_KEY`
(committed in `2f6c325`, present in earlier commits too). Anyone with repo
access — now or in the future, including anyone who ever cloned it — can send
Web Push notifications that appear to come from MathDOC.

The file is now placeholders, but **removing it from the working tree does not
remove it from history**. Rotate:

```bash
npx web-push generate-vapid-keys
```

Put the new pair in `.env.local` (and Vercel env vars), then restart. Rotation
is now safe: the client re-subscribes automatically when it detects a key
change, and the server prunes subscriptions that fail with 401/403.

Consider also purging history (`git filter-repo`) if the repo is or will be
shared, and treat the old key as permanently public regardless.

### 1.2 Set the Hutch SMS credentials

Student login is **real OTP only** — the simulated-login backdoor has been
deleted, so nobody can sign in until these are set in `.env.local` (and in
Vercel for production):

```
HUTCH_SMS_USERNAME=...
HUTCH_SMS_PASSWORD=...
HUTCH_SMS_MASK=...        # sender mask, pre-approved by Hutch
```

`HUTCH_SMS_PASSWORD` is a customer credential: `.env.local` and the Vercel
dashboard only, never a `NEXT_PUBLIC_` var, never committed. If it leaks,
anyone can send SMS billed to the customer's account — rotate it with Hutch
immediately.

### 1.3 Set `SUPABASE_AUTH_HOOK_SECRET`

> Full step-by-step setup: [docs/sms-otp-setup.md](docs/sms-otp-setup.md)

Currently empty. While empty, `/api/auth/sms-hook` refuses to run in production,
so **OTP delivery will not work** until you set it and configure the same value
in Supabase → Auth → Hooks. That secret is what stops anyone from POSTing to
your hook endpoint and sending SMS on your account.

---

## 2. What was fixed in this pass

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | **Stored XSS via `javascript:` URLs.** `youtube_url`/`facebook_url` had no URL validation; `meeting_link` used `z.string().url()`, which *accepts* `javascript:alert(1)` (verified). All three render into a raw `href`. | High | `httpUrlField` restricts the scheme at the schema layer; `safeExternalUrl()` re-checks at every render sink so already-poisoned rows stay inert. |
| 2 | **Rate-limit bypass.** `clientIp()` read the *first* `X-Forwarded-For` entry — fully client-controlled. Sending a random value per request gave a fresh bucket, defeating OTP-flood and admin-login brute-force limits. | High | Prefer platform headers (`x-vercel-forwarded-for`, `cf-connecting-ip`); otherwise take the **rightmost** XFF entry, the only one a client cannot forge. |
| 3 | **Dev login backdoor** — `devLoginWithPhone` signed in as any phone number with no OTP, gated only by `NODE_ENV`. | High | **Deleted entirely** along with the "Simulate OTP" button. Login is real OTP only. |
| 4 | **VAPID private key committed** to a tracked file. | High | Placeholders restored; rotation required (§1.1). |
| 5 | **R2 object-key IDOR.** Upload keys round-trip through the client and were stored unchecked, so a user could attach — and later have the server presign a download of — another user's file. | Medium | `keyBelongsTo()` enforces `purpose/<own user id>/<name>` on chat images, proof files, and task media, and rejects traversal. |
| 6 | **`'unsafe-eval'` in production CSP.** | Medium | Dropped in production (Next docs confirm React only needs it in dev). Added `object-src 'none'`, `worker-src`, `manifest-src`, `upgrade-insecure-requests`. |
| 7 | **No HSTS**, no cross-origin isolation headers. | Medium | Added `Strict-Transport-Security` (2y, subdomains, preload), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Permitted-Cross-Domain-Policies`. |
| 8 | `getAuth()` loaded the profile using the id decoded from the **unverified** JWT without tying it back to the verified user. | Low | Explicit `user.id === userId` and `profile.id === user.id` checks. |
| 9 | `markTaskChatSeen()` passed an unvalidated id to the query builder. | Low | UUID-validated. |

---

## 3. How each attack class is handled

### Authentication & sessions
- Sessions are **Supabase HttpOnly cookies** — not readable by JavaScript, so
  XSS cannot exfiltrate them directly.
- `proxy.ts` is a fast gate using `getSession()` (local cookie read). It is
  **not** the security boundary — it only checks that *a* session exists.
- The real boundary is `getAuth()`, which calls `getUser()` to validate the
  token against the Auth server, and `requireStudent()` / `requireAdmin()`,
  which re-check the role. These run in layouts *and* in every server action.
- Below that, **Postgres RLS** enforces `student_id = auth.uid() or is_admin()`
  on every table. Three independent layers: a forged cookie that somehow passed
  the proxy is still rejected twice more.

### Authorization (admin routes)
Every one of the 30+ server actions begins with `requireAdmin()` or an explicit
role check, then a rate limit. Auditing this is a one-liner — every action file
should show a guard on the first two lines of each export:

```bash
grep -n "export async function" -A3 src/features/**/server/*actions.ts
```

**Never** add an action that skips it. Being inside `src/app/admin/` protects
the *page*, not the *action* — actions are POST endpoints callable by anyone
who knows the id.

### Input validation
All input is validated **server-side with zod** (`src/lib/shared/schemas.ts`)
via `safeParse` on `unknown`. Client-side validation is convenience only.

Two properties worth preserving:
- **zod strips unknown keys**, so `{ ...parsed.data }` cannot smuggle extra
  columns. This is what stops a student POSTing `role: "admin"` into
  `saveProfile` — do not replace those spreads with raw `input`.
- Every id is `z.string().uuid()` before it reaches a query.

### SQL injection
Not reachable: all database access goes through the Supabase client's
parameterized query builder. There is no string-concatenated SQL. Keep it that
way — if you ever need `.rpc()` with raw SQL, parameterize it.

### XSS
- React escapes all interpolated text, and there is **no `dangerouslySetInnerHTML`
  anywhere** in the codebase. Keep that true.
- The remaining sink is URL attributes — covered by `safeExternalUrl()` (§2.1).
  **Any new `href={...}` or `src={...}` fed by stored data must go through it.**
- CSP is the backstop.

### CSRF
Next server actions are POST-only with an origin check, and cookies are
`SameSite=Lax`. `form-action 'self'` and `base-uri 'self'` are set. No
additional token needed.

### File uploads
- The R2 bucket is **private**; every read is a 15-minute presigned URL, every
  write a 5-minute presigned PUT.
- Content type and size are allowlisted per purpose (`UPLOAD_RULES`) *before*
  presigning.
- Keys are `purpose/userId/<random>-name` and ownership is enforced on store (§2.5).
- The local-disk fallback is dev-only and refuses to run in production.

### Rate limiting / brute force
`src/lib/server/ratelimit.ts`, applied to OTP request (per phone *and* per IP),
OTP verify, admin login, all forms, bookings, uploads, and public pages.

> **Known limitation:** the store is **in-memory**. It resets on deploy and is
> per-instance, so on multi-instance serverless the effective limit is
> `N × configured`. See §4.

### SMS gateway (Hutch)
The customer is billed per message, so the gateway is an abuse target.

- Credentials live only in server-side env vars, read inside a `server-only`
  module. They can never reach the browser bundle.
- **Nothing is logged that could leak the account**: never the password, never
  a token, never a full subscriber number (logs show `9477***567`), and gateway
  error bodies are logged but never returned to the UI.
- OTP send is rate limited **per phone AND per IP** before Supabase is called,
  so nobody can burn the SMS balance by hammering `requestOtp`.
- `/api/auth/sms-hook` is the one externally reachable path that triggers a
  send. It is authenticated by `SUPABASE_AUTH_HOOK_SECRET` (standard webhook
  signature) and **refuses to run in production when that secret is unset** —
  an unauthenticated hook would be a free SMS pump billed to the customer.
- Every request has a 15s timeout; a hung gateway cannot pile up requests.
- Concurrent sends share a single login attempt, so a burst never fires N
  parallel logins (which reads as credential stuffing to the provider).
- Numbers are re-validated as `94XXXXXXXXX` immediately before send.
- **Sending fails closed.** There is no simulated fallback that would report
  success for a message that was never sent.

### Secrets
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is only reachable through
  `createSupabaseAdmin()` in `server-only` modules — it can never reach the
  browser bundle. Every service-role query must be preceded by an explicit
  ownership check; `files.ts` carries that warning for a reason.
- Only `NEXT_PUBLIC_*` vars are sent to the browser. Never prefix a secret.

### Public token URLs (invoices, certificates)
The token *is* the credential: 48 hex chars (192 bits), format-validated before
lookup, rate-limited per IP, served `Cache-Control: private, no-store`. Not
guessable. Anyone with the link can view it — that is the intended design.

---

## 4. Recommended next steps (not yet done)

Ordered by value:

1. **Move rate limiting to Redis.** `UPSTASH_REDIS_REST_URL` / `_TOKEN` already
   exist in `.env.example`. Every call site goes through one `rateLimit()`
   function, so only that function's body changes. Do this before you scale
   past one instance — until then, in-memory limits are weaker than they look.
2. **Nonce-based CSP** to remove `'unsafe-inline'` from `script-src`. The Next
   guide is at `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.
   **Trade-off:** nonces force *every* page to render dynamically. Static pages
   (including `/login` and `/admin/login`) get no nonce and their inline scripts
   would be blocked — i.e. a botched rollout locks everyone out of login. Test
   on a preview deployment first. This is why it was not done blind here.
3. **Asymmetric JWT signing keys** (Supabase → Auth → JWT Keys), then swap
   `getUser()` for `getClaims()` in `getAuth()` — verifies locally, removing a
   network hop per navigation. Security-neutral, meaningful speed win. The
   project is currently on legacy HS256.
4. **Tighten `profileSchema`.** It is in "TESTING MODE" — every field optional,
   and `proofSubmitSchema` allows zero files. Re-tighten before launch.
5. **Add `public/icon-192.png`** so push notifications stop falling back to a
   default icon (cosmetic).

---

## 5. Deployment checklist

- [ ] Rotate VAPID keys; confirm the old private key is dead (§1.1)
- [ ] `HUTCH_SMS_USERNAME` / `HUTCH_SMS_PASSWORD` / `HUTCH_SMS_MASK` set server-side only
- [ ] `SUPABASE_AUTH_HOOK_SECRET` set, and matching in Supabase → Auth → Hooks
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set as a server-only env var
- [ ] R2 bucket has **no public access**
- [ ] Migrations 011–015 applied
- [ ] `NEXT_PUBLIC_APP_URL` points at the real HTTPS domain
- [ ] Confirm headers land: `curl -sI https://yourdomain | grep -iE 'strict-transport|content-security|x-frame'`
- [ ] Confirm `'unsafe-eval'` is **absent** from the production CSP
- [ ] Supabase: leaked-password protection on, OTP expiry short

---

## 6. Rules for future changes

1. Every server action starts with `requireAdmin()` / `requireStudent()` /
   `getAuth()`, then `rateLimit()`. No exceptions.
2. Validate with zod `safeParse` against `unknown`. Never trust a typed
   parameter as validation.
3. Never spread raw `input` into a database write — only `parsed.data`.
4. Any stored value reaching `href`/`src` goes through `safeExternalUrl()`.
5. Any client-supplied R2 key is checked with `keyBelongsTo()` before storage.
6. After any service-role query, ask: "have I checked this user owns this row?"
7. Never introduce `dangerouslySetInnerHTML`.
8. Run `npx tsc --noEmit && npx next build` before finishing.
