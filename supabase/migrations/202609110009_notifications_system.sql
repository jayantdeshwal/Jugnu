-- Phase 4: Real Notifications System
-- Automatic triggers on booking lifecycle events and worker approvals.

-- 1. Booking notifications trigger function
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

-- Attach trigger to public.bookings
drop trigger if exists trg_booking_notifications on public.bookings;
create trigger trg_booking_notifications
after insert or update of status on public.bookings
for each row
execute function public.handle_booking_notification();


-- 2. Worker approval notifications trigger function
create or replace function public.handle_worker_approval_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.approval_status is distinct from new.approval_status then
    if new.approval_status = 'approved' then
      insert into public.notifications (
        user_id,
        notification_type,
        title,
        body
      ) values (
        new.id,
        'profile_approved',
        'Worker Profile Approved',
        'Congratulations! Your worker profile has been approved. You are now active and ready to receive bookings.'
      );
    elsif new.approval_status = 'rejected' then
      insert into public.notifications (
        user_id,
        notification_type,
        title,
        body
      ) values (
        new.id,
        'profile_rejected',
        'Profile Needs Changes',
        coalesce('Your worker profile was rejected: ' || new.rejection_reason, 'Your registration requires changes before approval.')
      );
    end if;
  end if;

  return new;
end;
$$;

-- Attach trigger to public.worker_profiles
drop trigger if exists trg_worker_approval_notification on public.worker_profiles;
create trigger trg_worker_approval_notification
after update of approval_status on public.worker_profiles
for each row
execute function public.handle_worker_approval_notification();


-- 3. Helper RPCs for marking notifications read
create or replace function public.mark_notification_read(
  target_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update notifications';
  end if;

  update public.notifications
  set read_at = timezone('utc', now())
  where id = target_notification_id
    and user_id = auth.uid();
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;


create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update notifications';
  end if;

  update public.notifications
  set read_at = timezone('utc', now())
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

revoke execute on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;


-- 4. Delete policy for notifications (allowing users to dismiss/delete notifications)
drop policy if exists "Users can delete their notifications" on public.notifications;
create policy "Users can delete their notifications"
on public.notifications for delete
using (user_id = auth.uid());


-- 5. Safe registration to Supabase Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when undefined_object then null;
  when others then null;
end;
$$;
