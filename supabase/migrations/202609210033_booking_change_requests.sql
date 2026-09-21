-- Phase 3A: Job-linked additional-charge requests.
-- This records incremental requests only; public.bookings.id remains the canonical Job ID.

create table public.booking_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  decided_at timestamptz,
  constraint booking_change_requests_decision_timestamp check (
    (status = 'pending' and decided_at is null)
    or (status in ('approved', 'rejected', 'cancelled') and decided_at is not null)
  )
);

create unique index booking_change_requests_one_pending_per_booking
  on public.booking_change_requests(booking_id)
  where status = 'pending';

create index booking_change_requests_booking_idx
  on public.booking_change_requests(booking_id, created_at desc);

alter table public.booking_change_requests enable row level security;

grant select, insert on table public.booking_change_requests to authenticated;

create policy "Booking participants and admins can read change requests"
on public.booking_change_requests for select
using (
  public.is_admin()
  or exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.customer_id = auth.uid() or b.worker_id = auth.uid())
  )
);

create policy "Assigned workers can create pending change requests"
on public.booking_change_requests for insert
with check (
  worker_id = auth.uid()
  and status = 'pending'
  and decided_at is null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'worker'
  )
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.worker_id = auth.uid()
      and b.status in ('accepted', 'in_progress')
  )
);

-- All state changes go through the two RPCs below. No authenticated UPDATE policy is granted.

create or replace function public.create_booking_change_request(
  target_booking_id uuid,
  target_amount numeric,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to request an additional charge';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'worker'
  ) then
    raise exception 'Only workers can request an additional charge';
  end if;

  if target_amount is null or target_amount <= 0 then
    raise exception 'Additional amount must be greater than zero';
  end if;

  if target_reason is null or char_length(trim(target_reason)) = 0 then
    raise exception 'A reason is required for an additional charge';
  end if;

  if not exists (
    select 1 from public.bookings b
    where b.id = target_booking_id
      and b.worker_id = auth.uid()
      and b.status in ('accepted', 'in_progress')
  ) then
    raise exception 'Booking was not found, is not assigned to you, or is not eligible';
  end if;

  insert into public.booking_change_requests (booking_id, worker_id, amount, reason)
  values (target_booking_id, auth.uid(), target_amount, trim(target_reason))
  returning id into v_request_id;

  return v_request_id;
exception
  when unique_violation then
    raise exception 'A pending additional-charge request already exists for this booking';
end;
$$;

create or replace function public.decide_booking_change_request(
  target_request_id uuid,
  target_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to decide an additional charge';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'customer'
  ) then
    raise exception 'Only customers can decide an additional charge';
  end if;

  if target_decision not in ('approved', 'rejected') then
    raise exception 'Invalid additional-charge decision';
  end if;

  select r.status into v_status
  from public.booking_change_requests r
  join public.bookings b on b.id = r.booking_id
  where r.id = target_request_id
    and b.customer_id = auth.uid()
  for update of r;

  if v_status is null then
    raise exception 'Request was not found or does not belong to you';
  end if;

  if v_status <> 'pending' then
    raise exception 'Only pending additional-charge requests can be decided';
  end if;

  update public.booking_change_requests
  set status = target_decision,
      decided_at = timezone('utc', now())
  where id = target_request_id;
end;
$$;

revoke execute on function public.create_booking_change_request(uuid, numeric, text) from public;
grant execute on function public.create_booking_change_request(uuid, numeric, text) to authenticated;
revoke execute on function public.decide_booking_change_request(uuid, text) from public;
grant execute on function public.decide_booking_change_request(uuid, text) to authenticated;

create or replace function public.handle_booking_change_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_worker_name text;
  v_amount text;
begin
  select b.customer_id, coalesce(nullif(trim(p.full_name), ''), 'Your worker')
  into v_customer_id, v_worker_name
  from public.bookings b
  left join public.profiles p on p.id = new.worker_id
  where b.id = new.booking_id;

  v_amount := '₹' || to_char(new.amount, 'FM999999999990.00');

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, booking_id, notification_type, title, body)
    values (
      v_customer_id,
      new.booking_id,
      'additional_charge_requested',
      'Additional charge requested',
      v_worker_name || ' requested an additional charge of ' || v_amount || '. Please review it for this booking.'
    );
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, booking_id, notification_type, title, body)
    values (
      new.worker_id,
      new.booking_id,
      case when new.status = 'approved' then 'additional_charge_approved' else 'additional_charge_rejected' end,
      case when new.status = 'approved' then 'Additional charge approved' else 'Additional charge rejected' end,
      case when new.status = 'approved'
        then 'The customer approved your additional charge of ' || v_amount || '.'
        else 'The customer rejected your additional charge of ' || v_amount || '.'
      end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_booking_change_request_notification on public.booking_change_requests;
create trigger trg_booking_change_request_notification
after insert or update of status on public.booking_change_requests
for each row
execute function public.handle_booking_change_request_notification();
