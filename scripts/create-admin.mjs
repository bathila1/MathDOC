/**
 * Creates (or promotes) the teacher's admin account.
 *
 * Usage:
 *   node scripts/create-admin.mjs sir@example.com "StrongPassword123" "Sir's Name"
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY —
 * reads them from .env.local / .env automatically.
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

const [email, password, fullName = "Sir"] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> ["Full Name"]');
  process.exit(1);
}
if (password.length < 8) {
  console.warn(
    "⚠ Short password — fine for local testing, but change it before going live."
  );
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
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createErr) {
  if (/already/i.test(createErr.message)) {
    // Existing user — find them and reset the password instead.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) {
      console.error("Could not list users:", listErr.message);
      process.exit(1);
    }
    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!existing) {
      console.error("User exists but couldn't be found:", createErr.message);
      process.exit(1);
    }
    userId = existing.id;
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (pwErr) {
      console.error("Could not update password:", pwErr.message);
      process.exit(1);
    }
    console.log("User already existed — password updated.");
  } else {
    console.error("Could not create user:", createErr.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
  console.log("Auth user created.");
}

// The on_auth_user_created trigger makes the profile row; promote it to admin.
const { error: profileErr } = await admin
  .from("profiles")
  .upsert(
    { id: userId, role: "admin", full_name: fullName, profile_completed: true },
    { onConflict: "id" }
  );
if (profileErr) {
  console.error("Could not promote profile to admin:", profileErr.message);
  console.error("Did you run the SQL files in supabase/migrations/ first?");
  process.exit(1);
}

console.log("");
console.log("✔ Teacher admin account ready!");
console.log(`  Email:    ${email}`);
console.log("  Password: (the one you just chose)");
console.log("  Login at: /admin/login");
