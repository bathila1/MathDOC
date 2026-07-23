-- MathDOC access grants. Run after 003_rls.sql.
-- Supabase normally adds these automatically, but if tables were created
-- through a non-standard connection they can be missing — this makes it
-- explicit. RLS (003) still controls which ROWS each user can touch.

grant usage on schema public to authenticated, service_role;

-- The service role is trusted server code — full access (bypasses RLS anyway).
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Logged-in users: table-level access, with RLS deciding row visibility.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Future tables created by this role get the same grants automatically.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
