# SMS setup (Hutch + Supabase)

> **Student login no longer uses this.** It moved to email + password after the
> Hutch gateway stopped accepting our credentials and took the whole front door
> down with it — see **[email-auth-setup.md](email-auth-setup.md)**.
>
> Hutch still sends booking confirmations and certificate links, so everything
> below still applies to those. The OTP chain described in "The chain" is
> retained as history: `requestOtp` no longer exists, and the Send-SMS hook is
> only called if you re-enable phone auth in Supabase.
>
> **While the gateway is down, turn sending off** at Admin → Settings →
> **Text messages (SMS)**. Sends then return immediately instead of spending 15
> seconds each on a gateway that will refuse them. Turn it back on once the
> credentials are fixed.

How SMS delivery works, and the exact steps to make it work in production.
There is no simulated fallback — this path works or no message is sent.

## The chain (historic — this was the login path)

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

The app is served from **https://www.mathdoc.edu.lk**, so the hook URL is
`https://www.mathdoc.edu.lk/api/auth/sms-hook`. (`math-doc-five.vercel.app`
was once listed as a fallback but no longer serves this route — pointing the
Supabase hook there breaks student login outright.)

> **Security note on that endpoint:** it is the one externally reachable path
> that can trigger a billed SMS. The `SUPABASE_AUTH_HOOK_SECRET` signature check
> is what stops strangers POSTing to it and draining the customer's SMS balance.
> The route refuses to run in production when the secret is unset — that is
> deliberate, not a bug.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| **"Hutch SMS Gateway Authentication Error."** | Hutch refused our credentials — no token was issued, so no OTP can go out | **[Runbook below.](#runbook-hutch-sms-gateway-authentication-error)** |
| "We couldn't send the code right now" | `signInWithOtp` failed before Hutch | Phone provider disabled, or hook unreachable. In dev the real Supabase message is shown inline. |
| Supabase logs show a hook timeout | URL wrong or app not deployed | Confirm `https://<domain>/api/auth/sms-hook` returns 401 (not 404) to an unsigned POST. |
| Hook returns 401 | Secret mismatch | Re-copy the secret from Supabase into Vercel and redeploy. |
| Hook returns 500 "Hook secret not configured" | `SUPABASE_AUTH_HOOK_SECRET` unset in production | Set it and redeploy. |
| Hook returns 502 | Hutch rejected the send | Check Vercel logs for `Hutch SMS send failed: HTTP …`. |
| Hutch 401 on send | Token expired | Handled automatically (renew → retry). Persistent 401 means bad credentials. |
| Sends rejected with a mask error | Sender mask not approved | `MathDOC` is confirmed approved; a different value in `HUTCH_SMS_MASK` will fail. |

## Runbook: "Hutch SMS Gateway Authentication Error."

Student login shows this when the Hutch gateway rejects our account. It is
never the student's fault and retrying never helps — nobody can log in until
someone fixes the credentials. The message names the cause on purpose;
"check the number" used to send students chasing a fault that was ours.

**Confirm it.** From any machine — no deploy needed, and it sends no SMS:

```bash
curl -s -X POST https://bsms.hutch.lk/api/login \
  -H 'Content-Type: application/json' -H 'X-API-VERSION: v1' \
  -d '{"username":"mathdoc.lk@gmail.com","password":"<the password>"}'
```

- `{"accessToken":…}` → credentials are fine, look elsewhere (hook URL, secret).
- `401 Unauthorized` → this runbook. Vercel logs show the matching
  `Hutch SMS login failed: HTTP 401` and `STUDENT LOGIN IS DOWN: …`.

**Fix it, in order:**

1. **Check the password is actually reaching the app.** In `.env.local` a
   password containing `#` **must be quoted** — dotenv treats everything from
   an unquoted `#` onward as a comment and silently truncates the value:
   `HUTCH_SMS_PASSWORD="ab#cdef"`. Vercel dashboard values are stored raw and
   need no quotes, but check the value there was not pasted from a truncated
   copy.
2. **Ask Hutch whether the account is live.** A bulk-SMS account gets disabled
   for non-payment or an expired contract, and that presents as a plain 401 on
   `/api/login` — identical to a wrong password.
3. **Rotate the password** with the Hutch service agent, then set
   `HUTCH_SMS_PASSWORD` in the Vercel dashboard and **redeploy** (env changes
   do not reach running deployments).
4. **Re-test** with the curl above, then with a real login on the site.

**Want the exact reason on screen?** Admin → Settings → **Debug errors**. While
on, this message gains the precise failure mode (e.g.
`(reason: gateway_auth)` — the account was refused — versus
`(reason: not_configured)` — the `HUTCH_SMS_*` vars are missing from the
environment entirely). Turn it back off afterwards: those messages are shown to
anyone on the public login page.

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
