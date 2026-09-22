-- Stage 2A payment method and cash-confirmation foundation.
-- No gateway, UPI verification, or client-controlled payment completion is
-- introduced here.

alter table public.booking_payments
  add column if not exists payment_method text,
  add column if not exists customer_confirmed_at timestamptz,
  add column if not exists worker_confirmed_at timestamptz,
  add column if not exists paid_at timestamptz;

alter table public.booking_payments
  drop constraint if exists booking_payments_status_check;

alter table public.booking_payments
  add constraint booking_payments_status_check
  check (status in ('unpaid', 'pending', 'paid', 'failed', 'cancelled'));

alter table public.booking_payments
  add constraint booking_payments_payment_method_check
  check (payment_method is null or payment_method in ('upi', 'cash'));

-- Preserve Stage 2A field immutability and prevent a payment method from
-- changing once a cash confirmation is pending or payment is complete.
create or replace function public.guard_booking_payment_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.booking_id is distinct from new.booking_id
     or old.customer_id is distinct from new.customer_id
     or old.worker_id is distinct from new.worker_id
     or old.amount is distinct from new.amount
     or old.currency is distinct from new.currency
     or old.created_at is distinct from new.created_at then
    raise exception 'Payment obligation identity and amount are immutable';
  end if;

  if old.status in ('pending', 'paid')
     and old.payment_method is distinct from new.payment_method then
    raise exception 'Payment method cannot be changed after confirmation begins';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke execute on function public.guard_booking_payment_immutable_fields() from public, anon, authenticated;

-- A completed booking is permitted only after the payment obligation is paid.
create or replace function public.guard_booking_payment_boundary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status::text = 'in_progress' and new.status::text = 'payment_pending' then
    if not exists (
      select 1 from public.booking_payments p where p.booking_id = old.id
    ) then
      raise exception 'PAYMENT_OBLIGATION_REQUIRED';
    end if;
  elsif old.status::text = 'payment_pending'
    and new.status::text = 'completed'
    and not exists (
      select 1
      from public.booking_payments p
      where p.booking_id = old.id
        and p.status = 'paid'
    ) then
    raise exception 'PAYMENT_CONFIRMATION_REQUIRED';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_booking_payment_boundary() from public, anon, authenticated;

-- Keep direct booking updates aligned with the payment-before-completion
-- invariant while preserving the existing ownership and admin checks.
create or replace function public.guard_booking_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_customer boolean := false;
  v_is_worker boolean := false;
  v_is_admin boolean := false;
begin
  if session_user in ('postgres', 'supabase_admin') and auth.uid() is null then
    return new;
  end if;

  v_is_admin := public.is_admin();

  if v_is_admin then
    new.updated_at := timezone('utc', now());
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required to update bookings.';
  end if;

  v_is_customer := (auth.uid() = old.customer_id);
  v_is_worker := (auth.uid() = old.worker_id);

  if not v_is_customer and not v_is_worker then
    raise exception 'Unauthorized: You do not have permission to update this booking.';
  end if;

  if new.id <> old.id then
    raise exception 'Action prohibited: Booking ID is immutable.';
  end if;

  if new.customer_id <> old.customer_id then
    raise exception 'Action prohibited: Booking customer cannot be changed.';
  end if;

  if new.worker_id <> old.worker_id then
    raise exception 'Action prohibited: Assigned worker cannot be changed.';
  end if;

  if new.created_at <> old.created_at then
    raise exception 'Action prohibited: Booking creation timestamp is immutable.';
  end if;

  if old.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'Action prohibited: Completed, cancelled, or rejected bookings cannot be modified or reopened.';
  end if;

  if v_is_customer then
    if new.category_id <> old.category_id or new.service_area_id is distinct from old.service_area_id then
      raise exception 'Action prohibited: Booking service category and area cannot be altered after booking.';
    end if;

    if new.status is distinct from old.status then
      if old.status in ('pending', 'accepted') and new.status = 'cancelled' then
        null;
      else
        raise exception 'Invalid booking status transition for customer: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  if v_is_worker then
    if new.address <> old.address or new.category_id <> old.category_id or new.scheduled_at is distinct from old.scheduled_at then
      raise exception 'Action prohibited: Worker cannot alter customer address, category, or scheduled appointment time.';
    end if;

    if new.status is distinct from old.status then
      if old.status = 'pending' and new.status in ('accepted', 'rejected') then
        null;
      elsif old.status = 'accepted' and new.status = 'in_progress' then
        null;
      elsif old.status = 'in_progress' and new.status::text = 'payment_pending' then
        if exists (
          select 1
          from public.booking_change_requests
          where booking_id = old.id
            and status = 'pending'
        ) then
          raise exception 'Resolve pending additional charges before waiting for payment';
        end if;
      elsif old.status::text = 'payment_pending' and new.status = 'completed' then
        if not exists (
          select 1
          from public.booking_payments
          where booking_id = old.id
            and status = 'paid'
        ) then
          raise exception 'PAYMENT_CONFIRMATION_REQUIRED';
        end if;
      else
        raise exception 'Invalid booking status transition for worker: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- Customer chooses a supported method. UPI remains unpaid until a future
-- verified gateway integration exists.
create or replace function public.select_booking_payment_method(
  target_booking_id uuid,
  target_payment_method text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_status public.booking_status;
  v_payment_status text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to choose a payment method';
  end if;

  if target_payment_method not in ('upi', 'cash') then
    raise exception 'Unsupported payment method';
  end if;

  select b.status, p.status
  into v_booking_status, v_payment_status
  from public.bookings b
  join public.booking_payments p on p.booking_id = b.id
  where b.id = target_booking_id
    and b.customer_id = auth.uid()
  for update of b, p;

  if v_booking_status is null then
    raise exception 'Payment was not found or does not belong to you';
  end if;

  if v_booking_status <> 'payment_pending' then
    raise exception 'Payment is not available for this booking';
  end if;

  if v_payment_status <> 'unpaid' then
    raise exception 'Payment method cannot be changed after payment processing begins';
  end if;

  update public.booking_payments
  set payment_method = target_payment_method,
      updated_at = timezone('utc', now())
  where booking_id = target_booking_id;

  return target_payment_method;
end;
$$;

-- Customer confirmation moves cash to pending confirmation only. It never
-- marks the payment paid by itself.
create or replace function public.confirm_cash_payment_by_customer(target_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_status public.booking_status;
  v_payment_status text;
  v_payment_method text;
  v_customer_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to confirm a cash payment';
  end if;

  select b.status, p.status, p.payment_method, p.customer_confirmed_at
  into v_booking_status, v_payment_status, v_payment_method, v_customer_confirmed_at
  from public.bookings b
  join public.booking_payments p on p.booking_id = b.id
  where b.id = target_booking_id
    and b.customer_id = auth.uid()
  for update of b, p;

  if v_booking_status is null then
    raise exception 'Payment was not found or does not belong to you';
  end if;

  if v_payment_status = 'paid' then
    return 'paid';
  end if;

  if v_booking_status <> 'payment_pending' or v_payment_method <> 'cash' then
    raise exception 'Cash confirmation is not available for this booking';
  end if;

  if v_payment_status = 'pending' and v_customer_confirmed_at is not null then
    return 'pending';
  end if;

  if v_payment_status <> 'unpaid' then
    raise exception 'Cash confirmation is not available for this payment';
  end if;

  update public.booking_payments
  set status = 'pending',
      customer_confirmed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where booking_id = target_booking_id;

  return 'pending';
end;
$$;

-- Assigned worker confirmation completes the cash payment and booking in one
-- transaction. The booking trigger verifies the paid state before completion.
create or replace function public.confirm_cash_received_by_worker(target_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_status public.booking_status;
  v_payment_status text;
  v_payment_method text;
  v_customer_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to confirm cash received';
  end if;

  select b.status, p.status, p.payment_method, p.customer_confirmed_at
  into v_booking_status, v_payment_status, v_payment_method, v_customer_confirmed_at
  from public.bookings b
  join public.booking_payments p on p.booking_id = b.id
  where b.id = target_booking_id
    and b.worker_id = auth.uid()
  for update of b, p;

  if v_booking_status is null then
    raise exception 'Payment was not found or is not assigned to you';
  end if;

  if v_payment_status = 'paid' and v_booking_status = 'completed' then
    return 'paid';
  end if;

  if v_booking_status <> 'payment_pending'
     or v_payment_method <> 'cash'
     or v_payment_status <> 'pending'
     or v_customer_confirmed_at is null then
    raise exception 'Customer cash confirmation is required before confirming receipt';
  end if;

  update public.booking_payments
  set status = 'paid',
      worker_confirmed_at = timezone('utc', now()),
      paid_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where booking_id = target_booking_id;

  update public.bookings
  set status = 'completed',
      updated_at = timezone('utc', now())
  where id = target_booking_id
    and worker_id = auth.uid();

  return 'paid';
end;
$$;

revoke execute on function public.select_booking_payment_method(uuid, text) from public, anon;
grant execute on function public.select_booking_payment_method(uuid, text) to authenticated;
revoke execute on function public.confirm_cash_payment_by_customer(uuid) from public, anon;
grant execute on function public.confirm_cash_payment_by_customer(uuid) to authenticated;
revoke execute on function public.confirm_cash_received_by_worker(uuid) from public, anon;
grant execute on function public.confirm_cash_received_by_worker(uuid) to authenticated;

-- Extend the existing authorized summary with the payment-method and
-- two-party cash-confirmation state without introducing a second summary API.
drop function if exists public.get_booking_payment_summary(uuid);

create function public.get_booking_payment_summary(target_booking_id uuid)
returns table (
  booking_id uuid,
  initial_quote_amount numeric,
  approved_additional_amount numeric,
  final_payable_amount numeric,
  pending_additional_count bigint,
  has_initial_quote boolean,
  is_final boolean,
  payment_id uuid,
  payment_status text,
  currency text,
  is_frozen boolean,
  payment_method text,
  customer_confirmed_at timestamptz,
  worker_confirmed_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.booking_status;
  v_initial numeric;
  v_approved numeric;
  v_pending bigint;
  v_has_initial_quote boolean;
  v_payment_id uuid;
  v_payment_amount numeric;
  v_payment_status text;
  v_currency text;
  v_payment_method text;
  v_customer_confirmed_at timestamptz;
  v_worker_confirmed_at timestamptz;
  v_paid_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to view a booking payment summary';
  end if;

  select b.status
  into v_status
  from public.bookings b
  where b.id = target_booking_id
    and (b.customer_id = auth.uid() or b.worker_id = auth.uid() or public.is_admin());

  if v_status is null then
    raise exception 'Booking was not found or you do not have access';
  end if;

  select coalesce(sum(q.amount), 0), count(*) > 0
  into v_initial, v_has_initial_quote
  from public.booking_quotes q
  where q.booking_id = target_booking_id
    and q.status = 'accepted';

  select coalesce(sum(r.amount) filter (where r.status = 'approved'), 0),
         count(*) filter (where r.status = 'pending')
  into v_approved, v_pending
  from public.booking_change_requests r
  where r.booking_id = target_booking_id;

  select p.id, p.amount, p.status, p.currency, p.payment_method,
         p.customer_confirmed_at, p.worker_confirmed_at, p.paid_at
  into v_payment_id, v_payment_amount, v_payment_status, v_currency,
       v_payment_method, v_customer_confirmed_at, v_worker_confirmed_at, v_paid_at
  from public.booking_payments p
  where p.booking_id = target_booking_id;

  return query
  select target_booking_id,
         v_initial,
         v_approved,
         coalesce(v_payment_amount, v_initial + v_approved),
         v_pending,
         v_has_initial_quote,
         v_status = 'completed' and v_pending = 0 and v_has_initial_quote,
         v_payment_id,
         v_payment_status,
         v_currency,
         v_payment_id is not null,
         v_payment_method,
         v_customer_confirmed_at,
         v_worker_confirmed_at,
         v_paid_at;
end;
$$;

revoke execute on function public.get_booking_payment_summary(uuid) from public;
grant execute on function public.get_booking_payment_summary(uuid) to authenticated;
