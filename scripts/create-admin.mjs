/**
 * Creates (or re-seeds) the teacher's admin account.
 *
 * Usage — either form:
 *
 *   node scripts/create-admin.mjs sir 12345 "Sir"
 *   node scripts/create-admin.mjs sir@example.com "StrongPassword123" "Sir"
 *
 *   ADMIN_USERNAME=sir ADMIN_PASSWORD=12345 node scripts/create-admin.mjs
 *
 * A bare username (no "@") becomes <username>@mathdoc.local — the same rule the
 * admin login form applies, so "sir" here and "sir" on /admin/login are the
 * same account.
 *
 * Idempotent: an existing account gets its password reset and its profile
 * re-promoted to admin. Safe to run again after a migration.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — read from
 * .env.local / .env automatically.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// Mirrors adminLoginSchema in src/lib/shared/schemas.ts.
const ADMIN_DOMAIN = "mathdoc.local";
function toEmail(identity) {
  const v = identity.trim();
  return v.includes("@") ? v.toLowerCase() : `${v.toLowerCase()}@${ADMIN_DOMAIN}`;
}

const [argIdentity, argPassword, argName] = process.argv.slice(2);
const identity = argIdentity ?? process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL;
const password = argPassword ?? process.env.ADMIN_PASSWORD;
const fullName = argName ?? process.env.ADMIN_NAME ?? "Sir";

if (!identity || !password) {
  console.error(
    'Usage: node scripts/create-admin.mjs <username-or-email> <password> ["Full Name"]\n' +
      "   or: ADMIN_USERNAME=sir ADMIN_PASSWORD=... node scripts/create-admin.mjs"
  );
  process.exit(1);
}

const email = toEmail(identity);

// The teacher account is the highest-value credential on the site: it can read
// every student's details and delete their data. A weak one is worth stopping
// to say something about — but this is the operator's call, so it warns and
// carries on rather than refusing.
if (password.length < 10) {
  console.warn("");
  console.warn("⚠  WEAK ADMIN PASSWORD");
  console.warn(`   "${"*".repeat(password.length)}" is ${password.length} characters.`);
  console.warn("   This account can see and delete every student's data.");
  console.warn("   Fine for local testing. Before going live, re-run this script");
  console.warn("   with a password of at least 10 characters (a phrase works best).");
  console.warn("");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first."
  );
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId;
let outcome;

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (!createErr) {
  userId = created.user.id;
  outcome = "created";
} else if (/already|registered|exists/i.test(createErr.message)) {
  // Existing account. Find it by email on profiles first (one indexed lookup,
  // kept in step with auth.users by trigger since migration 024); fall back to
  // listing auth users only if that misses, e.g. on a pre-024 database.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profile?.id) {
    userId = profile.id;
  } else {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) {
      console.error("Could not look up the existing user:", listErr.message);
      process.exit(1);
    }
    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === email
    );
    if (!existing) {
      console.error("User exists but couldn't be found:", createErr.message);
      process.exit(1);
    }
    userId = existing.id;
  }

  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (pwErr) {
    console.error("Could not update the password:", pwErr.message);
    if (/password/i.test(pwErr.message)) {
      console.error(
        "Supabase is enforcing its minimum password length (Authentication → " +
          "Providers → Email → Minimum password length). Pick a longer one."
      );
    }
    process.exit(1);
  }
  outcome = "updated";
} else {
  console.error("Could not create the user:", createErr.message);
  if (/password/i.test(createErr.message)) {
    console.error(
      "Supabase is enforcing its minimum password length (Authentication → " +
        "Providers → Email → Minimum password length). Pick a longer one."
    );
  }
  process.exit(1);
}

// The on_auth_user_created trigger makes the profile row; promote it to admin.
const { error: profileErr } = await admin.from("profiles").upsert(
  {
    id: userId,
    email,
    role: "admin",
    full_name: fullName,
    profile_completed: true,
  },
  { onConflict: "id" }
);
if (profileErr) {
  console.error("Could not promote the profile to admin:", profileErr.message);
  console.error("Did you run the SQL files in supabase/migrations/ first?");
  process.exit(1);
}

console.log("");
console.log(`✔ Teacher admin account ${outcome === "created" ? "created" : "re-seeded"}.`);
console.log(`  Log in at:  /admin/login`);
console.log(`  Username:   ${identity.includes("@") ? email : identity.trim().toLowerCase()}`);
console.log(`  (stored as: ${email})`);
console.log("  Password:   the one you just set");
