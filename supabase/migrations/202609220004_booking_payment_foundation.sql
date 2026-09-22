-- Stage 2A payment foundation.
-- This creates the immutable payment obligation for a booking when the
-- authoritative worker transition reaches payment_pending. It does not
-- implement payment collection or payment confirmation.

create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'failed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.booking_payments enable row level security;

grant select on table public.booking_payments to authenticated;

create policy "Booking participants and admins can read payment obligations"
on public.booking_payments
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.bookings b
    where b.id = booking_payments.booking_id
      and (b.customer_id = auth.uid() or b.worker_id = auth.uid())
  )
);

-- The existing booking guard has a privileged administrative override. This
-- narrow trigger keeps the payment boundary intact even for direct status
-- updates: entering payment_pending requires the obligation row, while an
-- authenticated caller cannot manually confirm payment by selecting completed.
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
    and auth.uid() is not null then
    raise exception 'PAYMENT_CONFIRMATION_NOT_AVAILABLE';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_booking_payment_boundary() from public, anon, authenticated;

drop trigger if exists trg_guard_booking_payment_boundary on public.bookings;
create trigger trg_guard_booking_payment_boundary
before update of status on public.bookings
for each row execute function public.guard_booking_payment_boundary();

-- Replace the Stage 1 transition with the same authorization and transition
-- rules, adding atomic payment-obligation creation to the payment boundary.
create or replace function public.update_booking_status(
  target_booking_id uuid,
  target_status public.booking_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_initial numeric;
  v_approved numeric;
  v_accepted_quote_count bigint;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update a booking';
  end if;

  select * into v_booking
  from public.bookings
  where id = target_booking_id
    and worker_id = auth.uid()
  for update;

  if v_booking.id is null then
    raise exception 'Booking was not found or does not belong to you';
  end if;

  if v_booking.status = 'pending' and target_status in ('accepted', 'rejected') then
    null;
  elsif v_booking.status = 'accepted' and target_status = 'in_progress' then
    null;
  elsif v_booking.status = 'in_progress' and target_status::text = 'payment_pending' then
    if exists (
      select 1
      from public.booking_change_requests
      where booking_id = target_booking_id
        and status = 'pending'
    ) then
      raise exception 'PENDING_ADDITIONAL_CHARGES_EXIST';
    end if;

    select count(*), coalesce(sum(q.amount), 0)
    into v_accepted_quote_count, v_initial
    from public.booking_quotes q
    where q.booking_id = target_booking_id
      and q.status = 'accepted';

    if v_accepted_quote_count <> 1 then
      raise exception 'ACCEPTED_INITIAL_QUOTE_REQUIRED';
    end if;

    select coalesce(sum(r.amount), 0)
    into v_approved
    from public.booking_change_requests r
    where r.booking_id = target_booking_id
      and r.status = 'approved';

    if v_initial + v_approved <= 0 then
      raise exception 'INVALID_FINAL_PAYABLE_AMOUNT';
    end if;

    if exists (
      select 1 from public.booking_payments p where p.booking_id = target_booking_id
    ) then
      raise exception 'PAYMENT_OBLIGATION_ALREADY_EXISTS';
    end if;

    begin
      insert into public.booking_payments (
        booking_id, customer_id, worker_id, amount, currency, status
      ) values (
        v_booking.id, v_booking.customer_id, v_booking.worker_id,
        v_initial + v_approved, 'INR', 'unpaid'
      );
    exception when unique_violation then
      raise exception 'PAYMENT_OBLIGATION_ALREADY_EXISTS';
    end;
  else
    raise exception 'Invalid booking status transition from % to %', v_booking.status, target_status;
  end if;

  update public.bookings
  set status = target_status,
      updated_at = timezone('utc', now())
  where id = target_booking_id
    and worker_id = auth.uid();
end;
$$;

revoke execute on function public.update_booking_status(uuid, public.booking_status) from public;
grant execute on function public.update_booking_status(uuid, public.booking_status) to authenticated, service_role;

-- The summary remains dynamic before payment_pending and reads the frozen
-- obligation thereafter. is_final remains tied to completed, which is still
-- reserved for a future confirmed-payment transition.
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
  is_frozen boolean
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

  select p.id, p.amount, p.status, p.currency
  into v_payment_id, v_payment_amount, v_payment_status, v_currency
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
         v_payment_id is not null;
end;
$$;

revoke execute on function public.get_booking_payment_summary(uuid) from public;
grant execute on function public.get_booking_payment_summary(uuid) to authenticated;
