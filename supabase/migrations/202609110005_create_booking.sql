-- Customer booking request for an approved worker.

create or replace function public.create_booking(
  target_worker_id uuid,
  target_category_id text,
  target_pincode text,
  target_scheduled_at timestamptz,
  target_address text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_booking_id uuid;
  target_area_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a booking';
  end if;

  select id into target_area_id
  from public.service_areas
  where pincode = target_pincode;

  if target_area_id is null then
    raise exception 'This service area is not supported yet';
  end if;

  if not exists (
    select 1 from public.worker_profiles wp
    join public.worker_categories wc on wc.worker_id = wp.id
    join public.worker_service_areas wsa on wsa.worker_id = wp.id
    where wp.id = target_worker_id
      and wp.approval_status = 'approved'
      and wp.is_available = true
      and wc.category_id = target_category_id
      and wsa.service_area_id = target_area_id
  ) then
    raise exception 'This worker is not available for the selected service area';
  end if;

  insert into public.bookings (
    customer_id,
    worker_id,
    category_id,
    service_area_id,
    scheduled_at,
    address,
    notes
  ) values (
    auth.uid(),
    target_worker_id,
    target_category_id,
    target_area_id,
    target_scheduled_at,
    trim(target_address),
    nullif(trim(target_notes), '')
  ) returning id into new_booking_id;

  return new_booking_id;
end;
$$;

revoke execute on function public.create_booking(uuid, text, text, timestamptz, text, text) from public;
grant execute on function public.create_booking(uuid, text, text, timestamptz, text, text) to authenticated;
