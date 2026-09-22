-- Stage 2A payment foundation hardening.
-- Payment status remains intentionally updateable by future controlled
-- payment logic, but the obligation's identity, amount, currency, and
-- creation timestamp cannot be changed after insertion.

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

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke execute on function public.guard_booking_payment_immutable_fields() from public, anon, authenticated;

drop trigger if exists trg_guard_booking_payment_immutable_fields on public.booking_payments;
create trigger trg_guard_booking_payment_immutable_fields
before update on public.booking_payments
for each row execute function public.guard_booking_payment_immutable_fields();
