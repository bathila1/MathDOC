-- MathDOC functions & triggers. Run after 001_schema.sql.

-- True when the current session belongs to the teacher/admin.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profiles row for every new auth user (OTP signups and
-- dashboard-created admin users alike).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, phone, role)
  values (
    new.id,
    case when new.phone is not null and new.phone <> '' then '+' || new.phone end,
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

-- Atomically book a slot for the logged-in student.
-- Regular booking: creates a pending_payment appointment + unpaid invoice.
-- Follow-up ("Meet with Sir" checkpoint): free, auto-confirmed, no invoice,
-- and linked to the checkpoint task.
create or replace function book_appointment(
  p_slot_id uuid,
  p_mode appointment_mode,
  p_follow_up_task_id uuid default null
)
returns table (appointment_id uuid, invoice_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_slot availability_slots%rowtype;
  v_price numeric(10, 2);
  v_appointment_id uuid;
  v_invoice_token text;
  v_task tasks%rowtype;
begin
  if v_student is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Lock the slot row so two students can't book it at the same time.
  select * into v_slot from availability_slots
    where id = p_slot_id for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;
  if v_slot.status <> 'free' then
    raise exception 'SLOT_TAKEN';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'SLOT_IN_PAST';
  end if;
  if v_slot.mode <> 'either' and v_slot.mode::text <> p_mode::text then
    raise exception 'MODE_NOT_AVAILABLE';
  end if;

  if p_follow_up_task_id is not null then
    select * into v_task from tasks
      where id = p_follow_up_task_id
        and student_id = v_student
        and type = 'meet_sir';
    if not found then
      raise exception 'TASK_NOT_FOUND';
    end if;
    v_price := 0;
  else
    select coalesce(
      (select value::numeric from settings where key = 'appointment_price'),
      2000
    ) into v_price;
  end if;

  update availability_slots set status = 'booked' where id = p_slot_id;

  insert into appointments (student_id, slot_id, mode, status, price, is_follow_up)
  values (
    v_student,
    p_slot_id,
    p_mode,
    case when p_follow_up_task_id is not null then 'confirmed'::appointment_status
         else 'pending_payment'::appointment_status end,
    v_price,
    p_follow_up_task_id is not null
  )
  returning id into v_appointment_id;

  if p_follow_up_task_id is not null then
    update tasks set follow_up_appointment_id = v_appointment_id
      where id = p_follow_up_task_id;
  else
    insert into invoices (appointment_id, amount)
    values (v_appointment_id, v_price)
    returning public_token into v_invoice_token;
  end if;

  return query select v_appointment_id, v_invoice_token;
end;
$$;

revoke execute on function book_appointment(uuid, appointment_mode, uuid) from public, anon;
grant execute on function book_appointment(uuid, appointment_mode, uuid) to authenticated;
