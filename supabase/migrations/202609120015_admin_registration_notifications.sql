-- Phase 9+: Admin Registration & Important Event Notifications
-- 1. Notify all administrators whenever a worker registers or uploads ID verification documents
-- 2. Notify administrators on important booking events (new bookings, cancellations)
-- 3. Dedicated Admin Notifications RPC and RLS policies

-- 1. RLS Update on public.notifications for Administrators
drop policy if exists "Admins can view all notifications" on public.notifications;
create policy "Admins can view all notifications"
on public.notifications for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Admins can update notifications" on public.notifications;
create policy "Admins can update notifications"
on public.notifications for update
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- 2. Worker Registration & Document Notification Function for Admins
create or replace function public.notify_admins_on_worker_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_name text;
  v_category_name text;
  v_admin record;
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
begin
  -- Case A: New Worker Registration (INSERT pending) or Resubmission (UPDATE to pending)
  if (tg_op = 'INSERT' and new.approval_status = 'pending')
     or (tg_op = 'UPDATE' and old.approval_status <> 'pending' and new.approval_status = 'pending') then

    select full_name into v_worker_name from public.profiles where id = new.id;
    v_worker_name := coalesce(nullif(trim(v_worker_name), ''), 'New Worker');

    select c.name_en into v_category_name
    from public.worker_categories wc
    join public.categories c on c.id = wc.category_id
    where wc.worker_id = new.id
    limit 1;
    v_category_name := coalesce(v_category_name, 'Home Services');

    v_notif_type := 'worker_registration_submitted';
    v_notif_title := 'New Worker Registration Pending Review';
    v_notif_body := v_worker_name || ' submitted registration for ' || v_category_name || ' and is waiting for document verification and approval.';

    for v_admin in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (
        user_id,
        notification_type,
        title,
        body
      ) values (
        v_admin.id,
        v_notif_type,
        v_notif_title,
        v_notif_body
      );
    end loop;

  -- Case B: Worker uploaded or replaced ID Proof Document
  elsif tg_op = 'UPDATE'
        and old.id_proof_url is distinct from new.id_proof_url
        and new.id_proof_url is not null then

    select full_name into v_worker_name from public.profiles where id = new.id;
    v_worker_name := coalesce(nullif(trim(v_worker_name), ''), 'Worker');

    v_notif_type := 'worker_document_uploaded';
    v_notif_title := 'Worker ID Document Uploaded';
    v_notif_body := v_worker_name || ' uploaded a government ID verification document. Please inspect and verify.';

    for v_admin in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (
        user_id,
        notification_type,
        title,
        body
      ) values (
        v_admin.id,
        v_notif_type,
        v_notif_title,
        v_notif_body
      );
    end loop;
  end if;

  return new;
end;
$$;

-- Attach trigger to public.worker_profiles
drop trigger if exists trg_notify_admins_worker_events on public.worker_profiles;
create trigger trg_notify_admins_worker_events
after insert or update of approval_status, id_proof_url on public.worker_profiles
for each row
execute function public.notify_admins_on_worker_events();


-- 3. Cleanup: Ensure no booking notifications are sent to administrators
drop trigger if exists trg_notify_admins_booking_events on public.bookings;
drop function if exists public.notify_admins_on_booking_events();


-- 4. Dedicated RPC for Admin to fetch admin verification & registration notifications
create or replace function public.get_admin_notifications(limit_count integer default 50)
returns table (
  id uuid,
  user_id uuid,
  booking_id uuid,
  notification_type text,
  title text,
  body text,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: Administrator privileges required';
  end if;

  return query
  select
    n.id,
    n.user_id,
    n.booking_id,
    n.notification_type,
    n.title,
    n.body,
    n.read_at,
    n.created_at
  from public.notifications n
  where n.user_id = auth.uid()
     or n.notification_type in (
       'worker_registration_submitted',
       'worker_document_uploaded'
     )
  order by n.created_at desc
  limit limit_count;
end;
$$;

revoke execute on function public.get_admin_notifications(integer) from public;
grant execute on function public.get_admin_notifications(integer) to authenticated;
