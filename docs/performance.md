# Performance

What was measured, what was changed, and the one thing left that only you can
do. Measured on 2026-09-11 against a production build (`next build` +
`next start`) with a real admin session.

## Where the time actually goes

The tables are tiny — 3 profiles, 1 appointment, 17 slots — so this was never
about query cost or missing indexes. Every query, however trivial, costs a
**round-trip to Supabase**, and from the test machine that is ~146 ms each:

```
bare REST round-trip                   146 ms
profiles select by id                  117 ms
today's appointments (+slots)          136 ms
pending proofs count                   130 ms
```

Page time is therefore almost entirely *how many round-trips happen in
series*. Every admin page was doing two — `await requireAdmin()` (one query),
and only then its own queries (one more) — before a byte of HTML could go out.
`/admin/activity` did three.

## What changed in the code

**1. The guard and the data now run together.** `withAdmin()` /
`withStudent()` in `lib/server/auth.ts` start a page's queries immediately and
await the access check alongside them. Safe because every page query runs
through the RLS-scoped user client: a non-admin gets empty results and is
redirected regardless. Student pages take their user id straight from the
session cookie (`sessionUserId()`) so they need not wait for the profile row
either — RLS uses the *verified* token, so an unverified id can only ever
return that user's own rows.

Do not pass a fetcher that uses `createSupabaseAdmin()` to these helpers; the
service role bypasses RLS and the guard is the only thing in front of it.

**2. Settings are read once per request, not once per key.** The Settings page
fired nine separate queries (payments, SMS, debug errors, five notification
preferences); `getSetting()` now serves every caller from a single
request-cached read of the whole (tiny) table. `getSiteContent()` on the home
page joins the same read.

**3. The teacher's photo is optimised.** `public/sir.jpg` is a 678 KB PNG
(despite the name), and it was the largest thing on every login, signup and
reset page. Through `next/image` it is now served as AVIF at the displayed
size:

```
/sir.jpg  original         694,050 bytes
optimised  w=640            35,705 bytes
optimised  w=1200           41,665 bytes
```

That is a **94% reduction** on the first page every visitor sees — far more
than any server-side change on a phone connection.

## Measured result (admin TTFB, median of 5)

| Page | Before | After |
|---|---|---|
| `/admin` | 284 ms | **194 ms** |
| `/admin/activity` | 396 ms | **291 ms** |
| `/admin/availability` | 303 ms | 234 ms |
| `/admin/survey` | 264 ms | 249 ms |
| `/admin/proofs` | 276 ms | 249 ms |

Remaining time is the one unavoidable round-trip plus render.

## Region: functions live next to the database

**Supabase is in `ap-south-1` (Mumbai). `vercel.json` pins the functions to
`bom1`, Vercel's Mumbai region, to match.**

Before this file existed, functions ran in Vercel's default, `iad1`
(Washington DC) — so every round-trip in the table above crossed the planet
from the server as well, roughly 200 ms+ each in production. Co-located, the
same round-trip is typically under 20 ms. This is the single largest change on
this page; it just happens to be three lines.

If the Supabase project is ever moved, change the region here to match. The
mapping, for reference:

   | Supabase region | `vercel.json` |
   |---|---|
   | Singapore (`ap-southeast-1`) | `{ "regions": ["sin1"] }` |
   | Mumbai (`ap-south-1`) | `{ "regions": ["bom1"] }` |
   | Sydney (`ap-southeast-2`) | `{ "regions": ["syd1"] }` |
   | Tokyo (`ap-northeast-1`) | `{ "regions": ["hnd1"] }` |
   | Frankfurt (`eu-central-1`) | `{ "regions": ["fra1"] }` |
   | London (`eu-west-2`) | `{ "regions": ["lhr1"] }` |
   | N. Virginia (`us-east-1`) | already there — nothing to do |

Redeploy after changing it — the region is read at deploy time.

## Seeding the admin account

```
npm run seed:admin -- sir 12345 "Sir"
```

A bare username becomes `sir@mathdoc.local`, the same rule the login form uses.
Re-running it on an existing account resets the password and re-promotes the
profile, so it is safe after a migration.

The script warns when the password is under 10 characters and carries on. That
warning is worth heeding before go-live: this is the account that can read and
delete every student's data, and `12345` is the second most common password on
Earth.
