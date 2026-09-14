-- Phase 5: Booking Progress States
-- Allow workers to transition bookings:
--   pending -> accepted OR rejected
--   accepted -> in_progress (start job)
--   in_progress -> completed (finish job)

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

  -- Validate allowed state machine transitions
  if v_current_status = 'pending' and target_status in ('accepted', 'rejected') then
    -- Allowed: Accept or Reject incoming request
    null;
  elsif v_current_status = 'accepted' and target_status = 'in_progress' then
    -- Allowed: Start service
    null;
  elsif v_current_status = 'in_progress' and target_status = 'completed' then
    -- Allowed: Complete service
    null;
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


-- Update the booking notifications trigger function to also send in_progress notifications
create or replace function public.handle_booking_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text;
  v_worker_name text;
  v_category_name text;
begin
  -- Retrieve customer name
  select full_name into v_customer_name from public.profiles where id = new.customer_id;
  v_customer_name := coalesce(nullif(trim(v_customer_name), ''), 'Customer');

  -- Retrieve worker name
  select full_name into v_worker_name from public.profiles where id = new.worker_id;
  v_worker_name := coalesce(nullif(trim(v_worker_name), ''), 'Worker');

  -- Retrieve category name
  select name_en into v_category_name from public.categories where id = new.category_id;
  v_category_name := coalesce(v_category_name, new.category_id);

  if tg_op = 'INSERT' then
    -- When a booking is created, notify the assigned worker
    insert into public.notifications (
      user_id,
      booking_id,
      notification_type,
      title,
      body
    ) values (
      new.worker_id,
      new.id,
      'booking_created',
      'New booking request',
      v_customer_name || ' sent you a new booking request for ' || v_category_name || '.'
    );

  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'accepted' then
      -- Worker accepted -> notify customer
      insert into public.notifications (
        user_id,
        booking_id,
        notification_type,
        title,
        body
      ) values (
        new.customer_id,
        new.id,
        'booking_accepted',
        'Booking accepted',
        v_worker_name || ' accepted your ' || v_category_name || ' booking request.'
      );

    elsif new.status = 'in_progress' then
      -- Worker started service -> notify customer
      insert into public.notifications (
        user_id,
        booking_id,
        notification_type,
        title,
        body
      ) values (
        new.customer_id,
        new.id,
        'booking_in_progress',
        'Service in progress',
        v_worker_name || ' has started your ' || v_category_name || ' service.'
      );

    elsif new.status = 'rejected' then
      -- Worker rejected -> notify customer
      insert into public.notifications (
        user_id,
        booking_id,
        notification_type,
        title,
        body
      ) values (
        new.customer_id,
        new.id,
        'booking_rejected',
        'Booking declined',
        v_worker_name || ' was unable to take your ' || v_category_name || ' booking.'
      );

    elsif new.status = 'cancelled' then
      -- Notify opposing party
      if auth.uid() = new.customer_id then
        -- Customer cancelled -> notify worker
        insert into public.notifications (
          user_id,
          booking_id,
          notification_type,
          title,
          body
        ) values (
          new.worker_id,
          new.id,
          'booking_cancelled',
          'Booking cancelled',
          v_customer_name || ' cancelled the booking for ' || v_category_name || '.'
        );
      else
        -- Worker or system cancelled -> notify customer
        insert into public.notifications (
          user_id,
          booking_id,
          notification_type,
          title,
          body
        ) values (
          new.customer_id,
          new.id,
          'booking_cancelled',
          'Booking cancelled',
          'Your ' || v_category_name || ' booking has been cancelled.'
        );
      end if;

    elsif new.status = 'completed' then
      -- Booking completed -> prompt customer for review
      insert into public.notifications (
        user_id,
        booking_id,
        notification_type,
        title,
        body
      ) values (
        new.customer_id,
        new.id,
        'booking_completed',
        'Job completed',
        'Your service with ' || v_worker_name || ' is marked completed. Please share your rating and review.'
      );
    end if;
  end if;

  return new;
end;
$$;
