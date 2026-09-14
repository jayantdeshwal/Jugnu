-- Phase 6: Contact Actions & Booking Participant Privacy Policy
-- Allow users and booking participants to view each other's contact profile (phone, name, avatar)

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users and booking participants can read profiles" on public.profiles;

create policy "Users and booking participants can read profiles"
on public.profiles for select
using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.bookings b
    where (b.customer_id = auth.uid() and b.worker_id = public.profiles.id)
       or (b.worker_id = auth.uid() and b.customer_id = public.profiles.id)
  )
);

-- Secure RPC to look up the counterparty's contact details for a specific booking
create or replace function public.get_booking_contact_info(target_booking_id uuid)
returns table (
  contact_id uuid,
  contact_name text,
  contact_phone text,
  contact_role text,
  contact_avatar text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to view booking contact information';
  end if;

  select * into v_booking
  from public.bookings
  where id = target_booking_id
    and (customer_id = auth.uid() or worker_id = auth.uid() or public.is_admin());

  if v_booking.id is null then
    raise exception 'Booking not found or access denied';
  end if;

  if v_booking.customer_id = auth.uid() then
    -- Caller is the customer, return worker's profile
    return query
    select p.id, p.full_name, p.phone, p.role::text, p.avatar_url
    from public.profiles p
    where p.id = v_booking.worker_id;
  else
    -- Caller is the worker, return customer's profile
    return query
    select p.id, p.full_name, p.phone, p.role::text, p.avatar_url
    from public.profiles p
    where p.id = v_booking.customer_id;
  end if;
end;
$$;

revoke execute on function public.get_booking_contact_info(uuid) from public;
grant execute on function public.get_booking_contact_info(uuid) to authenticated;
