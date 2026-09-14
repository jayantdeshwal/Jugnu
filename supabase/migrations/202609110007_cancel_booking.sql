-- Allow customers to cancel only their own pending or accepted bookings.

create or replace function public.cancel_booking(
  target_booking_id uuid,
  cancellation_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to cancel a booking';
  end if;

  update public.bookings
  set status = 'cancelled',
      updated_at = timezone('utc', now()),
      notes = case 
        when cancellation_reason is not null and trim(cancellation_reason) <> '' 
        then coalesce(notes || E'\n[Cancelled by customer: ' || trim(cancellation_reason) || ']', '[Cancelled by customer: ' || trim(cancellation_reason) || ']')
        else notes
      end
  where id = target_booking_id
    and customer_id = auth.uid()
    and status in ('pending', 'accepted');

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    raise exception 'Booking was not found, does not belong to you, or is already completed/cancelled';
  end if;
end;
$$;

revoke execute on function public.cancel_booking(uuid, text) from public;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- Ensure RLS also permits direct update fallback for authenticated customers on their own pending/accepted bookings
drop policy if exists "Customers can cancel their pending or accepted bookings" on public.bookings;
create policy "Customers can cancel their pending or accepted bookings"
on public.bookings for update
using (
  customer_id = auth.uid()
  and status in ('pending', 'accepted')
)
with check (
  customer_id = auth.uid()
  and status = 'cancelled'
);
