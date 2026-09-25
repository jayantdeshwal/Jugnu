-- Cash-only payment completion and server-authoritative receipts.
-- Historical UPI rows are preserved, but new/active payment selection is cash-only.

create sequence if not exists public.booking_receipt_number_seq;

create table if not exists public.booking_receipts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  payment_id uuid not null unique references public.booking_payments(id) on delete restrict,
  receipt_number text not null unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  category_id text not null references public.categories(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  payment_method text not null check (payment_method = 'cash'),
  paid_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.booking_receipts enable row level security;
revoke all on table public.booking_receipts from anon, authenticated;
grant select on table public.booking_receipts to authenticated;

create policy "Booking participants and admins can read receipts"
on public.booking_receipts
for select
to authenticated
using (
  public.is_admin()
  or customer_id = auth.uid()
  or worker_id = auth.uid()
);

create or replace function public.guard_booking_receipt_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.booking_payments%rowtype;
begin
  select * into v_payment
  from public.booking_payments
  where id = new.payment_id
  for share;

  if v_payment.id is null
     or v_payment.status <> 'paid'
     or new.booking_id is distinct from v_payment.booking_id
     or new.amount is distinct from v_payment.amount
     or new.currency is distinct from v_payment.currency
     or new.payment_method is distinct from v_payment.payment_method
     or new.customer_id is distinct from v_payment.customer_id
     or new.worker_id is distinct from v_payment.worker_id then
    raise exception 'RECEIPT_PAYMENT_MISMATCH';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_booking_receipt_integrity() from public, anon, authenticated;

drop trigger if exists trg_guard_booking_receipt_integrity on public.booking_receipts;
create trigger trg_guard_booking_receipt_integrity
before insert or update on public.booking_receipts
for each row execute function public.guard_booking_receipt_integrity();

-- Preserve historical UPI rows. NOT VALID enforces this for new rows and
-- future updates while allowing legacy settled UPI records to remain.
alter table public.booking_payments
  drop constraint if exists booking_payments_payment_method_check;

alter table public.booking_payments
  add constraint booking_payments_cash_only_active_check
  check (
    payment_method is null
    or payment_method = 'cash'
    or (payment_method = 'upi' and status in ('paid', 'failed', 'cancelled'))
  ) not valid;

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

  if old.paid_at is distinct from new.paid_at then
    if old.status::text <> 'pending'
       or new.status::text <> 'paid'
       or current_setting('jugnu.cash_worker_confirmation', true) <> '1'
       or auth.uid() is null
       or auth.uid() is distinct from old.worker_id then
      raise exception 'Payment paid_at can only be set by worker cash confirmation';
    end if;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke execute on function public.guard_booking_payment_immutable_fields() from public, anon, authenticated;

create or replace function public.guard_booking_payment_boundary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status::text = 'in_progress' and new.status::text = 'payment_pending' then
    if not exists (select 1 from public.booking_payments p where p.booking_id = old.id) then
      raise exception 'PAYMENT_OBLIGATION_REQUIRED';
    end if;
  elsif old.status::text = 'payment_pending'
    and new.status::text = 'completed'
    and not exists (
      select 1
      from public.booking_payments p
      join public.booking_receipts r on r.payment_id = p.id and r.booking_id = old.id
      where p.booking_id = old.id and p.status = 'paid'
    ) then
    raise exception 'PAYMENT_RECEIPT_REQUIRED';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_booking_payment_boundary() from public, anon, authenticated;

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
  if target_payment_method <> 'cash' then
    raise exception 'Only cash payment is currently available';
  end if;

  select b.status, p.status into v_booking_status, v_payment_status
  from public.bookings b
  join public.booking_payments p on p.booking_id = b.id
  where b.id = target_booking_id and b.customer_id = auth.uid()
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
  set payment_method = 'cash', updated_at = timezone('utc', now())
  where booking_id = target_booking_id;
  return 'cash';
end;
$$;

revoke execute on function public.select_booking_payment_method(uuid, text) from public, anon;
grant execute on function public.select_booking_payment_method(uuid, text) to authenticated;

create or replace function public.confirm_cash_received_by_worker(target_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.booking_payments%rowtype;
  v_receipt public.booking_receipts%rowtype;
  v_receipt_created boolean := false;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to confirm cash received';
  end if;

  select * into v_booking
  from public.bookings
  where id = target_booking_id and worker_id = auth.uid()
  for update;
  if v_booking.id is null then
    raise exception 'Payment was not found or is not assigned to you';
  end if;

  select * into v_payment
  from public.booking_payments
  where booking_id = target_booking_id
  for update;
  if v_payment.id is null then
    raise exception 'Payment obligation was not found';
  end if;

  if v_payment.status = 'paid' and v_booking.status = 'completed' then
    select * into v_receipt from public.booking_receipts where booking_id = target_booking_id;
    if v_receipt.id is null then
      insert into public.booking_receipts (
        booking_id, payment_id, receipt_number, customer_id, worker_id,
        category_id, amount, currency, payment_method, paid_at
      ) values (
        v_booking.id, v_payment.id,
        'JUG-RCP-' || lpad(nextval('public.booking_receipt_number_seq')::text, 8, '0'),
        v_payment.customer_id, v_payment.worker_id, v_booking.category_id,
        v_payment.amount, v_payment.currency, 'cash',
        coalesce(v_payment.paid_at, timezone('utc', now()))
      );
    end if;
    return 'paid';
  end if;

  if v_booking.status <> 'payment_pending'
     or v_payment.payment_method <> 'cash'
     or v_payment.customer_confirmed_at is null
     or v_payment.status not in ('pending', 'paid') then
    raise exception 'Customer cash confirmation is required before confirming receipt';
  end if;

  if v_payment.status = 'pending' then
    perform set_config('jugnu.cash_worker_confirmation', '1', true);

    update public.booking_payments
    set status = 'paid',
        worker_confirmed_at = coalesce(worker_confirmed_at, timezone('utc', now())),
        paid_at = coalesce(paid_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = v_payment.id;

    select * into v_payment from public.booking_payments where id = v_payment.id;
  end if;

  insert into public.booking_receipts (
    booking_id, payment_id, receipt_number, customer_id, worker_id,
    category_id, amount, currency, payment_method, paid_at
  ) values (
    v_booking.id, v_payment.id,
    'JUG-RCP-' || lpad(nextval('public.booking_receipt_number_seq')::text, 8, '0'),
    v_payment.customer_id, v_payment.worker_id, v_booking.category_id,
    v_payment.amount, v_payment.currency, 'cash',
    coalesce(v_payment.paid_at, timezone('utc', now()))
  )
  on conflict (booking_id) do nothing
  returning * into v_receipt;

  v_receipt_created := v_receipt.id is not null;

  update public.bookings
  set status = 'completed', updated_at = timezone('utc', now())
  where id = v_booking.id;

  if v_receipt_created then
    begin
      insert into public.notifications (user_id, booking_id, notification_type, title, body)
      values
        (v_booking.customer_id, v_booking.id, 'payment_received', 'Payment received', 'Cash payment received and booking completed. Receipt: ' || v_receipt.receipt_number),
        (v_booking.worker_id, v_booking.id, 'payment_received', 'Payment received', 'Cash payment confirmed and booking completed. Receipt: ' || v_receipt.receipt_number);
    exception when others then
      raise warning 'Payment notification delivery failed for booking %: %', v_booking.id, sqlerrm;
    end;
  end if;

  return 'paid';
end;
$$;

revoke execute on function public.confirm_cash_received_by_worker(uuid) from public, anon;
grant execute on function public.confirm_cash_received_by_worker(uuid) to authenticated;

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
  paid_at timestamptz,
  receipt_number text,
  receipt_paid_at timestamptz
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
  v_receipt_number text;
  v_receipt_paid_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to view a booking payment summary';
  end if;

  select b.status into v_status
  from public.bookings b
  where b.id = target_booking_id
    and (b.customer_id = auth.uid() or b.worker_id = auth.uid() or public.is_admin());
  if v_status is null then
    raise exception 'Booking was not found or you do not have access';
  end if;

  select coalesce(sum(q.amount), 0), count(*) > 0
  into v_initial, v_has_initial_quote
  from public.booking_quotes q
  where q.booking_id = target_booking_id and q.status = 'accepted';

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

  select r.receipt_number, r.paid_at
  into v_receipt_number, v_receipt_paid_at
  from public.booking_receipts r
  where r.booking_id = target_booking_id;

  return query
  select target_booking_id, v_initial, v_approved,
         coalesce(v_payment_amount, v_initial + v_approved),
         v_pending, v_has_initial_quote,
         v_status = 'completed' and v_pending = 0 and v_has_initial_quote
           and v_payment_status = 'paid' and v_receipt_number is not null,
         v_payment_id, v_payment_status, v_currency, v_payment_id is not null,
         v_payment_method, v_customer_confirmed_at, v_worker_confirmed_at,
         v_paid_at, v_receipt_number, v_receipt_paid_at;
end;
$$;

revoke execute on function public.get_booking_payment_summary(uuid) from public;
grant execute on function public.get_booking_payment_summary(uuid) to authenticated;
