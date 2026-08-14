# SMS OTP setup (Hutch + Supabase)

How student login actually works, and the exact steps to make it work in
production. There is no simulated login any more — this path must work or
nobody can sign in.

## The chain

```
/login  →  requestOtp (server action)
        →  supabase.auth.signInWithOtp({ phone })
        →  Supabase Cloud calls YOUR app over the public internet:
             POST https://www.mathdoc.edu.lk/api/auth/sms-hook
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

## Production setup

The step-by-step setup (Vercel env vars, phone provider, hook secret, R2,
VAPID) lives in one place so it cannot drift:

👉 **[deployment.md](deployment.md)** — the full production runbook.

The app is served from **https://www.mathdoc.edu.lk** (with
`https://math-doc-five.vercel.app` as a fallback), so the hook URL is
`https://www.mathdoc.edu.lk/api/auth/sms-hook`.

> **Security note on that endpoint:** it is the one externally reachable path
> that can trigger a billed SMS. The `SUPABASE_AUTH_HOOK_SECRET` signature check
> is what stops strangers POSTing to it and draining the customer's SMS balance.
> The route refuses to run in production when the secret is unset — that is
> deliberate, not a bug.

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
