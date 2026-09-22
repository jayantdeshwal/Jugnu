-- Stage 1 payment boundary only.
-- This adds the waiting-for-payment state without introducing payment records,
-- payment providers, or a payment confirmation path.

alter type public.booking_status
  add value if not exists 'payment_pending' after 'in_progress';

-- Normal worker transitions stop at payment_pending. The future payment stage
-- will own payment_pending -> completed.
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
  v_current_status public.booking_status;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update a booking';
  end if;

  select status into v_current_status
  from public.bookings
  where id = target_booking_id
    and worker_id = auth.uid();

  if v_current_status is null then
    raise exception 'Booking was not found or does not belong to you';
  end if;

  if v_current_status = 'pending' and target_status in ('accepted', 'rejected') then
    null;
  elsif v_current_status = 'accepted' and target_status = 'in_progress' then
    null;
  elsif v_current_status = 'in_progress' and target_status::text = 'payment_pending' then
    if exists (
      select 1
      from public.booking_change_requests
      where booking_id = target_booking_id
        and status = 'pending'
    ) then
      raise exception 'Resolve pending additional charges before waiting for payment';
    end if;
  else
    raise exception 'Invalid booking status transition from % to %', v_current_status, target_status;
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

-- Keep the direct-update guard aligned with the authoritative RPC. Admins
-- retain the existing administrative override model.
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
      else
        raise exception 'Invalid booking status transition for worker: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- payment_pending remains active and keeps the existing customer/service slot.
create or replace function public.claim_booking_active_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.customer_service_active_slots%rowtype;
begin
  if new.status::text in ('pending', 'accepted', 'in_progress', 'payment_pending', 'disputed') then
    select * into v_slot
    from public.customer_service_active_slots
    where customer_id = new.customer_id
      and category_id = new.category_id
    for update;

    if v_slot.customer_id is null then
      begin
        insert into public.customer_service_active_slots (
          customer_id, category_id, source, booking_id
        ) values (
          new.customer_id, new.category_id, 'booking', new.id
        );
      exception when unique_violation then
        perform public.raise_active_service_request_exists();
      end;
    elsif v_slot.source = 'service_request' then
      update public.customer_service_active_slots
      set source = 'booking', booking_id = new.id, service_request_id = null
      where customer_id = new.customer_id
        and category_id = new.category_id;
    elsif v_slot.booking_id is distinct from new.id then
      perform public.raise_active_service_request_exists();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.release_booking_active_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status::text in ('pending', 'accepted', 'in_progress', 'payment_pending', 'disputed')
     and new.status::text not in ('pending', 'accepted', 'in_progress', 'payment_pending', 'disputed') then
    delete from public.customer_service_active_slots
    where booking_id = old.id
      and source = 'booking';
  end if;
  return new;
end;
$$;

-- Additional charges may be decided only while the booking is still in the
-- service lifecycle. This prevents the payable amount from changing after
-- payment_pending begins while preserving accepted/in_progress behavior.
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
  v_booking_status public.booking_status;
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

  select r.status, b.status
  into v_status, v_booking_status
  from public.booking_change_requests r
  join public.bookings b on b.id = r.booking_id
  where r.id = target_request_id
    and b.customer_id = auth.uid()
  for update of r;

  if v_status is null then
    raise exception 'Request was not found or does not belong to you';
  end if;

  if v_booking_status not in ('accepted', 'in_progress') then
    raise exception 'Additional charges cannot be changed after the service is ready for payment';
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

revoke execute on function public.decide_booking_change_request(uuid, text) from public;
grant execute on function public.decide_booking_change_request(uuid, text) to authenticated;
