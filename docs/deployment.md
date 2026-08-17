# MathDOC — Production deployment runbook

Everything needed to take the site from "deployed but broken" to fully working.
Follow the steps **in order** — later steps depend on earlier ones.

Written to be forwarded to whoever owns the Vercel project.

## The domain

**Canonical URL: `https://www.mathdoc.edu.lk`** — use this everywhere below.

DNS is already live and correct (verified):

| Record | Value | Status |
|---|---|---|
| `mathdoc.edu.lk` A | `216.198.79.1` (Vercel) | resolving; 308-redirects to www |
| `www.mathdoc.edu.lk` CNAME | `cd16f6a85d850ff2.vercel-dns-017.com` | resolving; TLS certificate valid |

Since the custom domain was attached, `https://math-doc-five.vercel.app` no
longer serves the app (it returns 404). Use `https://www.mathdoc.edu.lk` for
everything — testing included.

> DNS TTL is 86400 (24h). If you ever change these records, expect up to a day
> before the change is visible everywhere.

---

## Current status

The code is deployed and the domain reaches it, but **every page returns HTTP
500** because no environment variables were ever set in Vercel.

Why the whole site dies rather than just one feature: `src/proxy.ts` runs on
every request and builds a Supabase client from `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. When those are undefined it throws, so even
static files like `/sw.js` 500. Only `/favicon.ico` responds, because it is the
one path excluded from the proxy — which is how we know the deployment and TLS
are otherwise healthy.

Setting the variables in **Step 3** fixes the outage.

---

## Step 1 — Rotate the Web Push (VAPID) keys

The previous private key was committed to git, so it must be replaced. A fresh
pair has been generated and verified:

```

```

Use these in both `.env.local` and Vercel. To generate your own instead:
`npx web-push generate-vapid-keys`.

Rotating is safe: `src/lib/client/push.ts` notices the key changed and
re-subscribes each browser automatically, and
`src/features/notifications/server/push.ts` deletes subscriptions that fail with
401/403. Existing subscribers heal on their next visit.

> `VAPID_PRIVATE_KEY` is a secret. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public by
> design — it is meant to ship to the browser.

---

## Step 2 — Cloudflare R2 (file storage)

Without this, every proof upload, task video, voice note and chat image fails
with a 503. The bucket stays **private**; all access is via short-lived
presigned URLs (5 min for upload, 15 min for download).

1. Cloudflare dashboard → **R2** → **Create bucket**.
   Leave public access **disabled**.
2. **Manage R2 API Tokens** → create a token with **Object Read & Write**,
   scoped to that bucket. Copy the Access Key ID and Secret Access Key — the
   secret is shown only once.
3. Your **Account ID** is in the R2 overview page (also in the dashboard URL).

> **Current setup:** the configured bucket is `sagara-lms`, and credentials are
> verified working (presign succeeds). Two issues were found on it — see the
> two boxes below.

### ⚠️ Public access is currently ENABLED — turn it off

The bucket answers on its public `https://pub-….r2.dev` URL, which means every
uploaded object is readable by anyone holding the link, permanently. That
defeats the whole design: this app serves files through **15-minute presigned
URLs** precisely so a leaked link expires, and student proof uploads, chat
images and question images are private material.

Fix: bucket → **Settings** → **Public Development URL** → **Disable**.

Nothing in MathDOC reads that URL — `src/lib/server/files.ts` always presigns,
and `R2_PUBLIC_URL` is not referenced anywhere in the codebase, so disabling it
cannot break this app. **Check first whether another project shares this
bucket** (the name suggests it may), because that project might depend on the
public URL.

### CORS — required, and easy to miss

The browser uploads **directly** to R2 (`src/lib/client/upload.ts` PUTs to the
presigned URL), so without a CORS rule every upload fails with an opaque
browser error even though the credentials are correct.

The live bucket is **`mathdoc`** on account `09f4df4c33f70ae2955172b799b60372`
(confirmed from a failing upload URL). Cloudflare dashboard → R2 → `mathdoc` →
**Settings** → **CORS Policy** → Add:

```json
[
  {
    "AllowedOrigins": [
      "https://www.mathdoc.edu.lk",
      "https://mathdoc.edu.lk",
      "https://math-doc-five.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Without this rule the browser's `OPTIONS` preflight returns **403 Forbidden**
with no `access-control-allow-origin` header, and the upload never even starts.
That 403 comes from R2 rejecting the preflight, *not* from bad credentials — a
server-side PUT with the same presigned URL succeeds, because server requests
are not subject to CORS.

### This cannot be done with the app's API token

`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` are scoped to **Object Read &
Write**, which can upload and download objects but cannot change bucket
configuration — `GetBucketCors` / `PutBucketCors` both return `AccessDenied`.
The CORS rule must be set in the **Cloudflare dashboard** (or with a separate
Admin Read & Write token). Keep the app's token object-scoped; it does not need
more.

### Where the setting actually is

R2 → **Overview** → click the **`mathdoc`** bucket → **Settings** tab → scroll to
**CORS Policy** → *Add CORS policy* → paste the JSON → **Save**.

It is easy to set the wrong thing here: **CORS Policy** is a different section
from **Public access / R2.dev subdomain** further up the same page. Turning on
the public dev URL does nothing for uploads (see below).

### Verifying it worked

```bash
curl -s -o /dev/null -D - -X OPTIONS \
  "https://mathdoc.09f4df4c33f70ae2955172b799b60372.r2.cloudflarestorage.com/probe/x" \
  -H "Origin: https://www.mathdoc.edu.lk" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type"
```

Before: `HTTP/1.1 403 Forbidden`, no `access-control-*` headers at all.
After: `HTTP/1.1 200` plus `access-control-allow-origin: https://www.mathdoc.edu.lk`.

A 403 for **every** origin — including ones you never listed — means no rule
exists. A 403 for only *some* origins means the rule is there but the origin
string does not match exactly (scheme, host and port, no trailing slash).

### The public dev URL is not part of uploads

`https://pub-feebe911c22f4168a32273bf87c6fde1.r2.dev` is **read-only**: a `PUT`
to it returns `401 Unauthorized`, a `GET` returns `200`. Uploads go to the S3 API
host (`mathdoc.<account>.r2.cloudflarestorage.com`) — a completely different
endpoint. Enabling or disabling the dev URL has no effect on the upload error.

⚠️ It is currently **enabled**, which means every uploaded object is readable by
anyone who has the URL, with no expiry — student proof photos, diagnosis images,
invoices. That defeats the presigned-URL design the rest of the app uses.
`R2_PUBLIC_URL` is set in the environment but **no application code reads it**,
so switching public access off breaks nothing. Recommended: turn it off.

`content-type` is the only header the browser asks permission for; the
`content-length` in the URL's `X-Amz-SignedHeaders` is set by the browser
automatically and is not part of the preflight.

Origins must match **exactly** — scheme, host and port, no trailing slash.
`localhost` is included so uploads work in local development; drop it if you
would rather keep production strict.

Upload limits are enforced server-side at presign time and need no config:
10 MB images/PDFs, 60 MB video, 15 MB audio.

---

## Step 3 — Set the environment variables in Vercel

Vercel → project → **Settings → Environment Variables** → scope **Production**
(tick Preview too if you want preview deploys to work).

| Variable | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → `anon` `public` key | no |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role` key | **YES** |
| `NEXT_PUBLIC_APP_URL` | `https://www.mathdoc.edu.lk` (no trailing slash) | no |
| `HUTCH_SMS_USERNAME` | `mathdoc.lk@gmail.com` | no |
| `HUTCH_SMS_PASSWORD` | Hutch account password | **YES** |
| `HUTCH_SMS_MASK` | `MathDOC` | no |
| `SUPABASE_AUTH_HOOK_SECRET` | leave blank for now — created in Step 5 | **YES** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | from Step 1 | no |
| `VAPID_PRIVATE_KEY` | from Step 1 | **YES** |
| `VAPID_SUBJECT` | `mailto:riseupmediadev@gmail.com` | no |
| `R2_ACCOUNT_ID` | from Step 2 | no |
| `R2_ACCESS_KEY_ID` | from Step 2 | **YES** |
| `R2_SECRET_ACCESS_KEY` | from Step 2 | **YES** |
| `R2_BUCKET` | `mathdoc` | no |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → widget → site key | no |
| `TURNSTILE_SECRET_KEY` | same widget → secret key | **YES** |

`HUTCH_SMS_BASE_URL` is optional and defaults to `https://bsms.hutch.lk/api`.

> ⚠️ **`TURNSTILE_SECRET_KEY` is not optional in production.** The server fails
> closed without it: student login, OTP verification and teacher login all
> reject every attempt, and the Vercel log says
> `TURNSTILE_SECRET_KEY is not set — refusing to accept the request`. This is
> deliberate — a bot check that silently disables itself because a variable
> wasn't copied is worse than no check, because you would believe you were
> protected. In the Cloudflare Turnstile dashboard, the widget's **Hostnames**
> list must include `www.mathdoc.edu.lk` (add `localhost` too if you want to
> test the widget locally).

Do **not** set `ENABLE_DEV_LOGIN` — that backdoor has been removed from the code.

Never add a `NEXT_PUBLIC_` prefix to anything marked secret; that would ship it
to every visitor's browser.

**Then redeploy.** Vercel only picks up env changes on a new deployment —
Deployments → latest → ⋯ → **Redeploy**.

✅ **Checkpoint:** https://www.mathdoc.edu.lk/login should now load. If it still
500s, check the Vercel function logs — the app now names the missing variable
explicitly ("MathDOC is misconfigured: missing …"). Do not continue until this
loads.

---

## Step 3b — Apply pending database migrations

Migrations in `supabase/migrations/` are applied **by hand**, in filename order,
via Supabase → SQL Editor. Check the highest-numbered file in that folder
against what you have already run.

**`019_rate_limits.sql` must be applied.** It creates the shared counter table
and the `check_rate_limit()` function that every rate limit now uses. Until it
runs, the app falls back to a per-instance in-memory limiter and logs
`Rate limit DB check failed … Did migration 019 run?` on every attempt. Login
still works, but the limits are much weaker than they look — on Vercel each
lambda instance counts separately, so an attacker spreading requests across
instances gets a fresh budget each time. That is precisely what this migration
fixes, so do not leave it unapplied.

---

## Step 4 — Enable phone auth in Supabase

> ⚠️ **Do not skip this.** Skipping it produces exactly the symptom "We couldn't
> send the code right now" on `/login`, even when the SMS hook and Hutch are
> both perfectly configured. The underlying Supabase error is
> `phone_provider_disabled` / "Unsupported phone provider", visible in the
> Vercel function logs.

Supabase dashboard → **Authentication → Sign In / Up → Phone** → enable → Save.

Configuring the Send SMS hook (Step 5) is **not** a substitute. The hook
controls *how* the message is delivered; this toggle controls *whether* phone
login is permitted at all. With it off, Supabase rejects the request before your
app is ever contacted.

While you are in Authentication settings, set **Site URL** to
`https://www.mathdoc.edu.lk` and add it (plus
`https://math-doc-five.vercel.app`) to **Redirect URLs**, so links Supabase
generates point at the real domain.

If this is off, `signInWithOtp` fails before your app is ever contacted, and
login shows an error no matter how well the SMS gateway is configured.

You do **not** need Twilio, MessageBird or any built-in provider — the hook in
Step 5 replaces them entirely.

---

## Step 5 — Wire the Send SMS hook

Supabase → **Authentication → Hooks → Send SMS hook**:

- Type: **HTTPS**
- URL: `https://www.mathdoc.edu.lk/api/auth/sms-hook`
- Enable it, then **copy the generated secret** (looks like `v1,whsec_…`)

There is only **one** Send SMS hook per Supabase project, so this single URL
serves both the custom domain and the `.vercel.app` one — no need to change it
when testing on either.

Paste that value **verbatim** into `SUPABASE_AUTH_HOOK_SECRET` in Vercel, then
**redeploy again**. The app strips the `v1,whsec_` prefix itself, so do not
edit it.

> **Why the secret matters:** this endpoint is the only publicly reachable path
> that can trigger a billed SMS. The signature check is what stops a stranger
> POSTing to it and draining the customer's SMS balance. The route deliberately
> refuses to run in production when the secret is unset.

---

## Step 6 — Handing over secrets safely

Four values are genuinely dangerous:

- `SUPABASE_SERVICE_ROLE_KEY` — bypasses **all** database security rules; full
  read/write to every student's data.
- `HUTCH_SMS_PASSWORD` — sends SMS billed to the customer's Hutch account.
- `R2_SECRET_ACCESS_KEY` — read/write to all uploaded files.
- `VAPID_PRIVATE_KEY` — lets someone send push notifications as MathDOC.

Send them through a password manager share or a one-time secret link
(e.g. onetimesecret.com). **Not** WhatsApp, email, or a chat message — those
keep a permanent copy. If whoever holds them stops working on the project,
rotate all four.

---

## Verification

Run through these in order once all steps are done.

**1. Site is up**

```bash
curl -sI https://www.mathdoc.edu.lk/login
```
Expect `HTTP/2 200`, a `strict-transport-security` header, and a
`content-security-policy` that does **not** contain `'unsafe-eval'`.

Also check the apex still redirects: `curl -sI https://mathdoc.edu.lk/` → `308`.

**2. Hook is protected**

```bash
curl -s -o NUL -w "%{http_code}" -X POST https://www.mathdoc.edu.lk/api/auth/sms-hook
```

| Code | Meaning |
|---|---|
| **401** | Correct — signature rejected, hook is live and protected |
| 500 | `SUPABASE_AUTH_HOOK_SECRET` still unset, or not redeployed |
| 404 | Wrong URL in the Supabase hook config |

**3. Login end to end** — open `/login`, enter a real Sri Lankan mobile, submit.
The SMS should arrive within seconds. Hutch itself is already verified working
(live login returned 200; a test send returned `serverRef: 2638599891` using the
`MathDOC` mask), so any failure at this point is on the Supabase side — check
**Supabase → Logs → Auth**, then the Vercel function logs for lines starting
`Hutch SMS`.

**4. Uploads** — submit a proof with an image, then confirm the object appears
in the R2 bucket. A CORS error in the browser console means the Step 2 policy is
wrong or missing.

**5. Push** — allow notifications, then check the `push_subscriptions` table has
a row.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every page 500s | Supabase env vars missing | Step 3, then redeploy |
| Login: "couldn't send the code" | **Phone provider disabled** (`phone_provider_disabled`) — by far the most common cause | Step 4 |
| Login: "couldn't send the code", provider already on | Hook unreachable or misconfigured | Step 5 |
| Hook returns 500 | Secret unset in Vercel | Step 5, then redeploy |
| Hook returns 401 from Supabase | Secret mismatch | Re-copy from Supabase, redeploy |
| Hook returns 502 | Hutch rejected the send | Vercel logs → `Hutch SMS send failed: HTTP …` |
| Uploads fail, console shows CORS | R2 CORS policy | Step 2 |
| Uploads return 503 | R2 env vars missing | Step 3 |
| SMS links point at localhost | `NEXT_PUBLIC_APP_URL` wrong | Set to the real domain, redeploy |
| Push never arrives | Stale VAPID subscription | Self-heals on next visit after Step 1 |

---

## Related

- [sms-otp-setup.md](sms-otp-setup.md) — how the OTP chain works in detail
- [../SECURITY.md](../SECURITY.md) — security model and hardening notes
