# MathDoc — Personal Tutoring & Appointment Platform

A web app for a maths teacher ("Sir") to give individual attention to every
student: students book one-to-one sessions, Sir diagnoses their problems and
assigns a personal, ordered **task plan** ("mini-game"), students complete
tasks one by one with proof uploads, and a **digital certificate** is issued
when the plan is complete.

> **This README is the living project plan.** It is updated whenever a major
> decision or change is made.

---

## How it works

**Student journey**
1. Log in with a phone number — one-time SMS code (OTP), no password.
2. Register: personal details + a short **placement quiz** (auto-graded; Sir
   uses the score to categorize the student: Beginner / Intermediate / Advanced).
3. Book a session — in person or online — from Sir's free time slots.
4. Payment page appears (UI only for now — **"Skip payment" bypass button**
   until a payment gateway is linked).
5. SMS arrives with all details + a link to the **invoice** (view / print /
   download PDF from the site — no email involved).
6. After the session, Sir assigns ordered tasks. The dashboard shows a **big
   progress bar**; tasks unlock strictly one at a time.
7. For each task the student clicks **Upload proof** (photos/PDF of their
   work). Sir accepts it (next task unlocks) or rejects it with a note
   (student fixes and resubmits).
8. Some tasks are **"Meet with Sir"** checkpoints — the student books a free
   follow-up meeting to discuss progress.
9. When every task is approved → a **certificate** page + PDF is issued
   automatically and the link is sent by SMS.

**Teacher (admin) journey** — at `/admin` (email + password login)
- Dashboard: today's sessions, proofs waiting, student count, recent bookings.
- **Availability**: add/remove free slots (date, time range, in-person/online).
- **Appointments**: paste the online meeting link, write diagnosis notes,
  mark completed/cancelled, and **Add Task** (title, description, PDF/image
  attachment, or a Meet-with-Sir checkpoint). Tasks are editable, deletable
  and reorderable.
- **Students**: profiles, quiz scores with answers, category assignment,
  history and progress.
- **Proof reviews**: view uploaded files, Accept / Reject with a note.
- **Placement exam**: build/edit/reorder/deactivate the quiz questions.

---

## Tech stack & key decisions

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript), Tailwind CSS, shadcn/ui |
| Database | Supabase Postgres, **plain SQL files**, **RLS on every table** |
| DB access | `supabase-js` (`@supabase/ssr`) — queries run as the logged-in user |
| Student auth | Supabase phone OTP; OTP SMS delivered via **Send-SMS auth hook → SMSLenz** |
| Admin auth | Supabase email + password (profile `role = 'admin'`) |
| File storage | **Cloudflare R2** private bucket, presigned upload/download URLs |
| Rate limiting | Built-in in-memory sliding window on all client-facing actions (can swap to Upstash Redis later — one file: `src/lib/server/ratelimit.ts`) |
| SMS | **SMSLenz** (booking confirmations, certificate link, OTP) — no email anywhere |
| PDFs | `@react-pdf/renderer` server-side (invoice + certificate) |
| Payments | Deferred — mock payment UI with a bypass button |
| Hosting | Vercel |

**Dev simulation modes** (until third-party services are connected):
- No SMSLenz keys → SMS is printed to the terminal **and previewed on-screen**
  (amber cards); the login page shows a **🧪 Simulate OTP login** button
  (dev builds only) that skips the SMS entirely.
- No R2 keys → uploads are stored in `public/uploads/` locally.

---

## Getting started (local dev)

### 1. Install

```bash
npm install
```

### 2. Set up the database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open **SQL Editor** → paste the whole of [`supabase/SETUP.sql`](supabase/SETUP.sql)
   → **Run**. (It creates every table, function, RLS policy and some sample
   data. The individual files live in `supabase/migrations/` if you prefer to
   run them one by one: `001_schema.sql` → `002_functions.sql` → `003_rls.sql`
   → `seed.sql`.)

### 3. Environment variables

```bash
copy .env.example .env.local    # then fill in the Supabase values
```

Minimum required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Project Settings → API).

### 4. Teacher's login

The SQL setup auto-promotes the account `sir@mathdoc.local` to admin, so the
teacher just logs in at **`/admin/login`** with username **`sir`** (or the full
email) and their password. To create or reset that account:

```bash
node scripts/create-admin.mjs sir@mathdoc.local "THE-PASSWORD" "Sir"
```

(Students log in at **`/login`** with their phone number.)

### 5. Run

```bash
npm run dev
```

In dev, use the **🧪 Simulate OTP login** button on `/login` — no SMS service
needed.

---

## Connecting the real services (production)

### SMSLenz (SMS + OTP delivery)
1. Create an account at [smslenz.lk](https://smslenz.lk), get `user_id`,
   `api_key` and an approved `sender_id` → put them in the env vars.
2. In Supabase: **Authentication → Sign In / Up → Phone** → enable phone provider.
3. **Authentication → Hooks → Send SMS hook** → HTTPS →
   `https://YOUR-DOMAIN/api/auth/sms-hook` → copy the generated secret into
   `SUPABASE_AUTH_HOOK_SECRET`. Supabase now delivers every OTP through SMSLenz.

### Cloudflare R2 (file storage)
1. Cloudflare dashboard → **R2 Object Storage** → Create bucket `mathdoc-files`.
   Keep it **private** (no public access).
2. **R2 → Manage R2 API Tokens** → Create token with **Object Read & Write**
   scoped to the bucket → copy the Access Key ID + Secret.
3. Your Account ID is in the dashboard sidebar. Env vars: `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
4. Bucket settings → **CORS policy**:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://YOUR-DOMAIN"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   (The browser uploads directly to R2 with short-lived presigned URLs.)

### Payment gateway
Not integrated yet — the payment page is UI-only with a
**"Skip payment for now"** button. When a gateway is chosen (e.g. PayHere),
replace `bypassPayment` in
`src/features/booking/server/actions.ts` with the real charge flow and remove
the bypass button from `src/features/booking/client/PaymentPanel.tsx`.

---

## Project structure

```
src/
  app/                    # thin routes only — logic lives in features/
    (public)/             # landing, login/OTP, register, invoice/[token], certificate/[token]
    student/              # dashboard (progress bar), exam, book, tasks/[id]
    admin/(auth)/login    # teacher login (outside the guarded panel)
    admin/(panel)/        # dashboard, availability, appointments, students, proofs, exam
    api/                  # auth/sms-hook, uploads/presign, uploads/local, pdf/*
  features/               # one folder per domain — client/ and server/ SEPARATED
    auth|exam|booking|invoices|tasks|certificates|students/
      client/             # "use client" components
      server/             # server actions, queries, PDF renderers
  lib/
    client/               # browser supabase client, upload helper
    server/               # server/admin supabase clients, r2, sms, ratelimit, auth guards
    shared/               # zod schemas, types, constants, phone utils
  middleware.ts           # session refresh + /student /admin gate
supabase/
  SETUP.sql               # ← paste this one file into the Supabase SQL editor
  migrations/             # the same, split into numbered files
  seed.sql                # sample quiz questions + slots
scripts/create-admin.mjs  # creates/promotes the teacher's admin account
```

**Convention:** nothing inside `features/*/client/` ever imports from
`features/*/server/`. Routes import from features, not the other way around.

---

## Security model

- **RLS everywhere** — students can only read/write their own rows even if
  app code has a bug; the teacher's access goes through the `is_admin()`
  policy. Sensitive writes (grading, payment bypass, task unlocks,
  certificates) run server-side with explicit ownership checks.
- **SQL injection**: all queries go through the parameterized supabase-js
  builder; zero string-built SQL.
- **XSS**: React escaping, no `dangerouslySetInnerHTML`, strict security
  headers + CSP in `next.config.ts`.
- **Validation**: every form/action validates with Zod on the client *and*
  the server, returning friendly field-level messages.
- **Rate limits** (in-memory sliding window): OTP 3/15 min per phone, login
  8/15 min, bookings 10/10 min, uploads 30/10 min, public invoice/certificate
  pages 60/10 min per IP, etc. (`src/lib/server/ratelimit.ts` — swap the store
  for Upstash Redis if the app moves to multi-instance serverless).
- **Files**: R2 bucket is private; uploads/downloads only via short-lived
  presigned URLs after auth + ownership checks; type/size validated
  (PDF/JPG/PNG/WebP, ≤ 10 MB).
- **Booking race**: slot locking + a partial unique index prevent
  double-booking; bookings go through one atomic SQL function.

## Task-game rules (source of truth)

- Tasks belong to an appointment and run strictly in `sort_order`.
- Exactly one task is `active` (or `proof_submitted` while awaiting review);
  later tasks are `locked`; done tasks are `approved`.
- Accepting a proof approves the task and unlocks the next; rejecting returns
  it to `active` with Sir's note.
- Progress % = approved / total. At 100% a certificate row is created
  (once) and the student gets the link by SMS.
- `meet_sir` tasks need no proof — the student books a free follow-up and Sir
  approves the checkpoint after the meeting.

## Roadmap / TODO

- [ ] Link a real payment gateway (PayHere / Stripe) and remove the bypass.
- [ ] Connect SMSLenz + configure the Supabase Send-SMS hook (remove simulate button reliance).
- [ ] Set up Cloudflare R2 for production file storage.
- [ ] Change the teacher's password to a strong one before going live.
- [ ] Re-add Upstash Redis rate limiting when deploying to serverless (Vercel) at scale.
- [ ] Deploy to Vercel (`NEXT_PUBLIC_APP_URL` must be the real domain).
- [ ] Optional: admin setting page for session price & location (currently in `settings` table, editable via SQL/Studio).
