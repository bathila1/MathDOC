# SMS OTP setup (Hutch + Supabase)

How student login actually works, and the exact steps to make it work in
production. There is no simulated login any more — this path must work or
nobody can sign in.

## The chain

```
/login  →  requestOtp (server action)
        →  supabase.auth.signInWithOtp({ phone })
        →  Supabase Cloud calls YOUR app over the public internet:
             POST https://<your-domain>/api/auth/sms-hook
             (signed with SUPABASE_AUTH_HOOK_SECRET)
        →  sendSms()  →  Hutch  →  student's handset
```

**The third step is why this cannot work on `localhost`.** Supabase is a hosted
service; it cannot reach `http://localhost:3000`. Local OTP requires a public
tunnel (cloudflared/ngrok) or a deployment.

## Verified working

- Hutch login as `mathdoc.lk@gmail.com` → HTTP 200, tokens issued.
- Hutch send with mask `MathDOC` → HTTP 200, `serverRef` returned.

So the gateway and the mask are confirmed good. Anything still failing is in
the Supabase → app hop.

---

## Production setup (Vercel)

### 1. Set environment variables in Vercel

Project → Settings → Environment Variables. All of these are **server-side
secrets** — do not prefix any with `NEXT_PUBLIC_`.

| Variable | Value |
|---|---|
| `HUTCH_SMS_USERNAME` | `mathdoc.lk@gmail.com` |
| `HUTCH_SMS_PASSWORD` | (from Hutch) |
| `HUTCH_SMS_MASK` | `MathDOC` |
| `SUPABASE_AUTH_HOOK_SECRET` | generated in step 3 below |
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain` (used in SMS links) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | **rotated** keys — see SECURITY.md §1.1 |
| `R2_*` | Cloudflare R2 credentials |

`HUTCH_SMS_BASE_URL` is optional; it defaults to `https://bsms.hutch.lk/api`.

Do **not** set `ENABLE_DEV_LOGIN` — it no longer exists.

### 2. Enable phone auth in Supabase

Dashboard → **Authentication → Sign In / Up → Phone** → enable the phone
provider. Without this, `signInWithOtp` fails before your hook is ever called.

You do **not** need to configure Twilio/MessageBird — the Send SMS hook
replaces the built-in provider entirely.

### 3. Configure the Send SMS hook

Dashboard → **Authentication → Hooks → Send SMS hook**:

- Type: **HTTPS**
- URL: `https://<your-domain>/api/auth/sms-hook`
- Copy the generated secret (it looks like `v1,whsec_…`) into the Vercel env
  var `SUPABASE_AUTH_HOOK_SECRET`, then **redeploy** so the new env is picked up.

The route strips the `v1,whsec_` prefix itself, so paste the value exactly as
Supabase gives it.

> **Security:** this endpoint is the one externally reachable path that can
> trigger a billed SMS. The signature check is what stops strangers POSTing to
> it and draining the customer's SMS balance. The route refuses to run in
> production when the secret is unset — that is deliberate, not a bug.

### 4. Verify

1. Open `https://<your-domain>/login`, enter a real number, submit.
2. The SMS should arrive within seconds.
3. If it does not, check **Supabase → Logs → Auth** for the hook call, then
   your Vercel function logs for `Hutch SMS`-prefixed errors.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "We couldn't send the code right now" | `signInWithOtp` failed before Hutch | Phone provider disabled, or hook unreachable. In dev the real Supabase message is shown inline. |
| Supabase logs show a hook timeout | URL wrong or app not deployed | Confirm `https://<domain>/api/auth/sms-hook` returns 401 (not 404) to an unsigned POST. |
| Hook returns 401 | Secret mismatch | Re-copy the secret from Supabase into Vercel and redeploy. |
| Hook returns 500 "Hook secret not configured" | `SUPABASE_AUTH_HOOK_SECRET` unset in production | Set it and redeploy. |
| Hook returns 502 | Hutch rejected the send | Check Vercel logs for `Hutch SMS send failed: HTTP …`. |
| Hutch 401 on send | Token expired | Handled automatically (renew → retry). Persistent 401 means bad credentials. |
| Sends rejected with a mask error | Sender mask not approved | `MathDOC` is confirmed approved; a different value in `HUTCH_SMS_MASK` will fail. |

## Local development

Student OTP login cannot work against `localhost`. Options:

1. **Test on the deployment** (chosen approach) — do student-login work against
   the Vercel URL.
2. **Tunnel**, if you need it locally later:
   `cloudflared tunnel --url http://localhost:3000`, then point the Supabase
   hook at the generated HTTPS URL. Remember to point it back afterwards —
   there is only one Send SMS hook per Supabase project, so a tunnel URL left
   configured will break production login.

Admin login (`/admin/login`, email + password) does not use SMS and works
locally as normal.
