-- Shared, atomic rate-limit counters.
--
-- WHY: the app previously counted hits in a module-level Map. That works on a
-- single long-lived server, but on Vercel every concurrent lambda instance gets
-- its own empty Map and cold starts wipe it. An attacker spreading requests
-- across instances got a fresh budget each time, which silently defeated the
-- OTP-flood and admin-login brute-force limits. Counters have to live somewhere
-- all instances can see, so they live here.
--
-- Fixed window rather than a sliding log: one row per key instead of one row
-- per request, so the table cannot grow without bound and needs no vacuuming
-- strategy. The trade-off is that a caller can burst up to 2x the limit across
-- a window boundary, which is acceptable for these thresholds.

create table if not exists public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer     not null default 0
);

-- Used only by the stale-row sweep below.
create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

-- No policies are defined, so with RLS on, anon and authenticated can reach
-- nothing here. The function below is SECURITY DEFINER and is called with the
-- service-role key from the server only.
alter table public.rate_limits enable row level security;

-- Count one hit against `p_key` and report whether it is allowed.
--
-- The whole check is a single INSERT .. ON CONFLICT DO UPDATE, so concurrent
-- callers serialise on the row lock and cannot race past the limit. Doing it in
-- two statements (read then write) would let simultaneous requests both observe
-- count = limit - 1 and both proceed.
create or replace function public.check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_window interval    := make_interval(secs => p_window_seconds);
  v_count  integer;
  v_start  timestamptz;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
                  when rl.window_start < v_now - v_window then 1
                  else rl.count + 1
                end,
        window_start = case
                  when rl.window_start < v_now - v_window then v_now
                  else rl.window_start
                end
  returning rl.count, rl.window_start into v_count, v_start;

  -- Opportunistic sweep of keys nobody has touched for a day. Runs on ~1% of
  -- calls so it costs nothing amortised and needs no cron job.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < v_now - interval '1 day';
  end if;

  return query
    select
      v_count <= p_limit,
      greatest(
        0,
        ceil(extract(epoch from (v_start + v_window - v_now)))
      )::integer;
end;
$$;

-- Callable only by the server. If anon could call this, anyone could pin a
-- victim's phone number at its limit and lock them out of login entirely.
revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon;
revoke all on function public.check_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
