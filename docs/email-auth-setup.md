# Email + password login (students)

Student login used to be an SMS one-time code. It travelled
`Supabase → our Send-SMS hook → Hutch → the handset`, so when Hutch stopped
accepting our credentials the entire front door shut and nobody could sign in.
Identity now lives somewhere we control.

SMS still carries booking confirmations and certificate links — see
[sms-otp-setup.md](sms-otp-setup.md) for that side. It is simply no longer the
key to the door.

---

## What a student sees

| Route | Purpose |
|---|---|
| `/signup` | Create an account: email + password |
| `/login` | Log in |
| `/forgot-password` | Request a reset link |
| `/reset-password` | Set a new password (only reachable from a reset link) |
| `/auth/confirm` | Where signup-confirmation links land |
| `/auth/recovery` | Where password-reset links land |
| `/register` | The existing profile step — now also collects the student's phone |

Sessions behave exactly as before: a student stays logged in until they log
out. Supabase's refresh token is rotated by `proxy.ts` on every navigation.

---

## Setup, in order

### 1. Run the migration

`supabase/migrations/024_email_password_auth.sql` in the Supabase SQL editor.

It adds `profiles.email` (uniquely indexed on `lower(email)`), backfills it
from `auth.users`, and rewrites the new-user trigger so an email signup lands a
usable profile row. It also adds a trigger that keeps `profiles.email` in step
when an address is confirmed or changed later.

**Nothing works before this runs.** It is additive and safe to re-run.

### 2. Turn the Email provider on

Supabase → Authentication → Providers → **Email**: enabled.

### 3. Decide about email confirmation

Authentication → Providers → Email → **Confirm email**.

> ### Decision: Confirm email is OFF
>
> **Turn it off** — Authentication → Providers → Email → untick **Confirm
> email** → Save. Students are then logged in the moment they sign up, and
> registration needs no email delivery at all.
>
> Verify it took effect: `<SUPABASE_URL>/auth/v1/settings` (public) should
> report `"mailer_autoconfirm": true`. It read `false` on 2026-09-10, which
> is why signup was blocked.
>
> **The trade:** nothing checks that the address is real or spelled correctly,
> and that address is the student's only way back into the account. A typo at
> signup means password reset can never reach them — fix it from Supabase →
> Authentication → Users, or add the student again from the admin panel.
>
> **This does not fix password reset.** Reset still emails a link, so it still
> needs SMTP (step 4).

|  | Confirm email OFF | Confirm email ON |
|---|---|---|
| After signup | Logged straight in | Must click a link first |
| Needs working SMTP to sign up | No | **Yes** |
| Guards against typo'd/fake addresses | No | Yes |

The app handles both — `signUpStudent` checks whether a session came back and
shows a "check your email" screen when it did not, so you can flip this setting
without a code change.

> **If SMTP is not configured yet, start with it OFF.** Turning it on without
> working email recreates exactly the failure this migration was escaping: an
> account nobody can get into, for a reason the student cannot act on.

### 4. Configure SMTP — the one thing that blocks go-live

Authentication → Emails → **SMTP Settings**.

Supabase's built-in sender is rate limited to a handful of messages per hour
and is explicitly not for production. Point it at a real provider (Resend,
Brevo, SendGrid, Amazon SES — all have free tiers big enough for a tuition
class).

**Password reset needs this even with confirmation off** — which is exactly
the configuration this project runs (step 3). Without SMTP, "Forgot password"
goes nowhere: the action deliberately reports success whether or not the
address exists, so a mail failure looks identical to a delivered mail from the
outside.

Two ways to see the truth when a send fails:

- The Vercel log carries `resetPasswordForEmail failed: … — check Supabase SMTP
  settings`.
- Admin → Settings → **Debug errors** shows the real error on the page. It is
  safe to read here: Supabase answers *successfully* for an address with no
  account, so any error is about our mail setup and never about who has an
  account.

**The no-email escape hatch:** Admin → Students → "Add student" creates the
account with the email already confirmed and a password the teacher sets by
hand. That path sends no mail at all, so it keeps working even with SMTP
completely unconfigured. It is the fallback if tomorrow arrives before SMTP
does.

### 5. Set the redirect allowlist

Authentication → URL Configuration:

- **Site URL**: `https://www.mathdoc.edu.lk`
- **Redirect URLs** — add **both**, or reset silently breaks:
  - `https://www.mathdoc.edu.lk/auth/confirm`
  - `https://www.mathdoc.edu.lk/auth/recovery`
  - (plus `http://localhost:3000/auth/*` for local work)

`NEXT_PUBLIC_APP_URL` must match the Site URL — the app builds the link it
hands Supabase from it. A mismatch sends students to the wrong host.

> **Why two paths, and why no query strings.** Supabase glob-matches the whole
> `redirect_to` — query string included — against this allowlist. A URL like
> `/auth/confirm?flow=recovery` does **not** match an allowlisted
> `/auth/confirm`, and Supabase then quietly falls back to the Site URL: the
> student lands on the homepage, nothing happens, and no error appears
> anywhere. Recovery therefore has its own bare path instead of a query flag.
> If a reset link ever dumps someone on the homepage, this allowlist is the
> first thing to check.

### 6. Switch the email templates to `{{ .TokenHash }}`

Authentication → Emails → Templates. For **Confirm signup** and
**Reset password**, make the link:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery
```

(Query strings are fine *here* — this is the link inside the email body, which
Supabase does not match against the redirect allowlist. The allowlist only
applies to the `redirect_to` the app sends in step 5.)

Why bother: the default `{{ .ConfirmationURL }}` uses the PKCE `code` flow,
which only works in the *same browser* that requested it. Students open mail in
Gmail's in-app viewer, or on a phone when they signed up on a laptop — and the
link then fails with nothing to explain why. `token_hash` has no such
requirement.

Both routes accept either shape, so an unmodified project still works. This
step upgrades it from "works sometimes" to "works".

**Until you do this, reset links only work in the browser that asked for them.**
The default templates use PKCE, whose code verifier lives in a cookie on the
requesting browser — so a student who asks on a laptop and taps the link on
their phone gets nothing.

Two things carry that situation until SMTP is configured:

1. **"Open the link in this window."** The "check your email" screen tells the
   student to *copy* the link rather than tap it, and gives them a box to paste
   it into. Pasting carries the link back to the browser holding the cookie, so
   it completes normally. Only this site's origin and the Supabase project's
   own origin are accepted there — it will not navigate anywhere else.
2. A link opened in the wrong browser returns to `/forgot-password` saying so,
   rather than failing blankly.

Both are workarounds. Custom SMTP plus `{{ .TokenHash }}` templates is the
actual fix, and makes the link work anywhere.

### 7. Turn on leaked-password protection

Authentication → Policies → **Prevent use of leaked passwords**. Supabase
checks new passwords against HaveIBeenPwned. It costs nothing and stops the
single most common weak choice.

---

## Existing students

**Read this before switching over.** Accounts created under the old flow have a
phone number and *no email or password*, so they cannot log in through the new
form. Nothing in the migration invents credentials for them.

Two ways to bring someone across, both from Admin → Students:

1. **Add them again with an email and a first password** (the "Add student"
   dialog). The teacher sets the password and hands it over in person — this
   path needs no working email at all. Note this creates a *new* account: their
   existing tasks, bookings and certificates stay on the old row.
2. **Set an email on the existing auth user** in the Supabase dashboard
   (Authentication → Users → the user → email), then have the student use
   "Forgot password" to choose one. This keeps all their history, and needs
   working SMTP.

Option 2 is the right one for a student with history. If there are more than a
handful, say so and this is worth scripting rather than clicking.

---

## Turning SMS off while Hutch is down

Admin → Settings → **Text messages (SMS)**.

While off, `sendSms()` returns immediately instead of calling Hutch, so
booking confirmations and certificate links are simply not texted. Nothing else
changes — booking, certificates and login all carry on, and login has not
depended on SMS since this migration.

Worth doing while the gateway is refusing our credentials: every attempted send
otherwise burns up to 15 seconds waiting for a reply that never comes and
writes an error to the log, which buries real problems. Turn it back on once
Hutch is fixed — see [sms-otp-setup.md](sms-otp-setup.md).

The setting defaults to **on**, so an untouched install behaves exactly as
before.

## Security notes

What is already enforced in code, so you know what not to re-invent:

- **Rate limits** (`lib/server/ratelimit.ts`, shared Postgres counter): signup
  5/hour per IP; password reset 4/hour per IP *and* per address; login 8 per 15
  min per IP *and* per account, so rotating IPs does not buy an attacker an
  unbounded password spray at one student.
- **Turnstile** on signup, login and forgot-password, each with its own action
  name so a token minted on the public signup widget cannot be spent on admin
  login. Not on `/reset-password`: getting there already required a single-use
  link from the account's own inbox.
- **Password rules** (`newPasswordField`): 10 characters minimum, at least one
  letter and one number, 72 bytes maximum because bcrypt silently truncates
  past that. Matched with Unicode classes, so a Sinhala or Tamil passphrase is
  accepted.
- **No account enumeration on reset**: `/forgot-password` answers identically
  whether or not the address exists. `/signup` does say when an email is
  already taken — a deliberate trade, since the alternative is students
  silently re-registering and losing their work.
- **Other sessions are revoked** on every password reset and change
  (`signOut({ scope: "others" })`). Locking out whoever prompted the reset is
  half the point of resetting; the session that just set the password survives.
- **`/reset-password` needs a grant cookie** that only `/auth/confirm` sets,
  and only after verifying a genuine recovery token. Without it, a live session
  on an unlocked laptop would be enough to change the password without knowing
  the old one. `changePassword` (profile page) re-authenticates with the
  current password instead.

## Turning the detail on when something breaks

Admin → Settings → **Debug errors** makes login, signup and reset report the
underlying Supabase error instead of a friendly summary. Turn it back off
afterwards: those messages are shown to anyone on the public login page.
