-- Authoritative read-only payment summary for an authorized booking.
-- The amount is derived from the accepted worker quote and approved
-- additional charges; no persistent or user-editable total is introduced.

create function public.get_booking_payment_summary(target_booking_id uuid)
returns table (
  booking_id uuid,
  initial_quote_amount numeric,
  approved_additional_amount numeric,
  final_payable_amount numeric,
  pending_additional_count bigint,
  has_initial_quote boolean,
  is_final boolean
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
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to view a booking payment summary';
  end if;

  select b.status
  into v_status
  from public.bookings b
  where b.id = target_booking_id
    and (
      b.customer_id = auth.uid()
      or b.worker_id = auth.uid()
      or public.is_admin()
    );

  if v_status is null then
    raise exception 'Booking was not found or you do not have access';
  end if;

  select coalesce(sum(q.amount), 0)
  into v_initial
  from public.booking_quotes q
  where q.booking_id = target_booking_id
    and q.status = 'accepted';

  select coalesce(sum(r.amount) filter (where r.status = 'approved'), 0),
         count(*) filter (where r.status = 'pending')
  into v_approved, v_pending
  from public.booking_change_requests r
  where r.booking_id = target_booking_id;

  return query
  select target_booking_id,
         v_initial,
         v_approved,
         v_initial + v_approved,
         v_pending,
         exists (
           select 1
           from public.booking_quotes q
           where q.booking_id = target_booking_id
             and q.status = 'accepted'
         ),
         v_status = 'completed' and v_pending = 0 and exists (
           select 1
           from public.booking_quotes q
           where q.booking_id = target_booking_id
             and q.status = 'accepted'
         );
end;
$$;

revoke execute on function public.get_booking_payment_summary(uuid) from public;
grant execute on function public.get_booking_payment_summary(uuid) to authenticated;
