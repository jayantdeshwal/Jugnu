-- Allow workers to accept or reject only their own pending booking requests.

create or replace function public.update_booking_status(
  target_booking_id uuid,
  target_status public.booking_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update a booking';
  end if;

  if target_status not in ('accepted', 'rejected') then
    raise exception 'Workers can only accept or reject pending bookings';
  end if;

  update public.bookings
  set status = target_status,
      updated_at = timezone('utc', now())
  where id = target_booking_id
    and worker_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Booking was not found or is no longer pending';
  end if;
end;
$$;

revoke execute on function public.update_booking_status(uuid, public.booking_status) from public;
grant execute on function public.update_booking_status(uuid, public.booking_status) to authenticated;