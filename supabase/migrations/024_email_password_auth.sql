-- Students sign in with email + password instead of an SMS OTP.
--
-- Background: login used to go Supabase -> Send-SMS hook -> Hutch -> handset.
-- When Hutch stopped accepting our credentials nobody could log in at all, so
-- the identity moved to something we can deliver ourselves. SMS is still used
-- for booking confirmations and certificates; it is just no longer the key to
-- the front door.
--
-- `phone` stays on profiles (Sir still needs to call students) but is now
-- collected during registration rather than being the login identifier.

-- ---------- profiles.email ----------

alter table profiles add column if not exists email text;

-- Case-insensitive: Supabase lowercases auth emails, and without this a
-- backfilled "A@b.lk" and a fresh signup of "a@b.lk" would be two accounts
-- pointing at one inbox.
create unique index if not exists profiles_email_lower_key
  on profiles (lower(email));

-- Backfill anyone who already has an email on the auth side (the teacher's
-- admin account, and any student created with one).
update profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and u.email is not null
  and u.email <> ''
  and p.email is distinct from u.email;

-- ---------- keep profiles.email in step with auth.users ----------

-- Recreated (was: phone only) so an email signup lands a usable profile row.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, phone, email, role)
  values (
    new.id,
    case when new.phone is not null and new.phone <> '' then '+' || new.phone end,
    nullif(new.email, ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- A confirmed email arrives as an UPDATE to auth.users, not an insert, and a
-- student may change their address later. Without this the profiles copy
-- silently rots and the admin list shows a stale address.
create or replace function handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = nullif(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function handle_user_email_change();
