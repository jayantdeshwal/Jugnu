-- Phase 10: Admin Permanent Profile Deletion
-- Allows verified administrators to permanently remove a worker or customer profile from the platform,
-- safely cascading through all foreign-key dependencies (bookings, reviews, complaints, notifications, categories, auth).

-- 1. Drop existing functions to avoid ambiguous signatures in PostgREST
drop function if exists public.admin_delete_profile_permanently(uuid);
drop function if exists public.admin_delete_profile_permanently(text);

-- 2. Create the robust deletion RPC accepting text
create or replace function public.admin_delete_profile_permanently(target_profile_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid;
  v_target_uuid uuid;
  v_target_role text;
  v_target_name text;
  v_target_phone text;
  v_deleted_bookings_count int := 0;
  v_deleted_reviews_count int := 0;
begin
  v_admin_id := auth.uid();

  -- 1. Security Check: Caller must be an administrator
  if not public.is_admin() then
    raise exception 'Unauthorized: Only platform administrators can permanently delete accounts.';
  end if;

  -- 2. Validate and convert UUID
  begin
    v_target_uuid := target_profile_id::uuid;
  exception when others then
    raise exception 'Invalid profile ID format: %', target_profile_id;
  end;

  -- 3. Safety Check: Cannot delete yourself
  if v_target_uuid = v_admin_id then
    raise exception 'Action prohibited: Administrators cannot delete their own profile from the admin console.';
  end if;

  -- 4. Verify target profile exists in public.profiles or auth.users
  select role::text, full_name, phone
  into v_target_role, v_target_name, v_target_phone
  from public.profiles
  where id = v_target_uuid;

  if not found then
    -- Check if it exists strictly in auth.users (orphan user)
    if exists (select 1 from auth.users where id = v_target_uuid) then
      delete from auth.users where id = v_target_uuid;
      return jsonb_build_object(
        'success', true,
        'deleted_id', target_profile_id,
        'notice', 'Orphan authentication record removed'
      );
    end if;

    raise exception 'Profile not found with ID: %', target_profile_id;
  end if;

  -- 5. Safety Check: Cannot delete another admin
  if v_target_role = 'admin' then
    raise exception 'Action prohibited: Cannot delete another administrator profile.';
  end if;

  -- 6. Cascade Delete: Complaints (where user is complainant, respondent, or related booking)
  delete from public.complaints
  where opened_by = v_target_uuid
     or against_user = v_target_uuid
     or booking_id in (
       select id from public.bookings
       where customer_id = v_target_uuid or worker_id = v_target_uuid
     );

  -- 7. Cascade Delete: Reviews (where user is reviewer, reviewee, or related booking)
  with del_reviews as (
    delete from public.reviews
    where customer_id = v_target_uuid
       or worker_id = v_target_uuid
       or booking_id in (
         select id from public.bookings
         where customer_id = v_target_uuid or worker_id = v_target_uuid
       )
    returning id
  )
  select count(*) into v_deleted_reviews_count from del_reviews;

  -- 8. Cascade Delete: Notifications (for this user or related bookings)
  delete from public.notifications
  where user_id = v_target_uuid
     or booking_id in (
       select id from public.bookings
       where customer_id = v_target_uuid or worker_id = v_target_uuid
     );

  -- 9. Cascade Delete: Bookings (where user is customer or worker)
  with del_bookings as (
    delete from public.bookings
    where customer_id = v_target_uuid
       or worker_id = v_target_uuid
    returning id
  )
  select count(*) into v_deleted_bookings_count from del_bookings;

  -- 10. If Target is a Worker: Remove service areas, categories, and worker_profile
  delete from public.worker_service_areas where worker_id = v_target_uuid;
  delete from public.worker_categories where worker_id = v_target_uuid;
  delete from public.worker_profiles where id = v_target_uuid;

  -- 11. Delete the core profile row
  delete from public.profiles where id = v_target_uuid;

  -- 12. Delete from auth.users if account was registered via Supabase Auth
  delete from auth.users where id = v_target_uuid;

  -- 13. Audit Log in admin_actions if admin is authenticated
  if v_admin_id is not null then
    begin
      insert into public.admin_actions (
        admin_id,
        action,
        target_table,
        target_id,
        details
      ) values (
        v_admin_id,
        'permanent_profile_deleted',
        'profiles',
        v_target_uuid,
        jsonb_build_object(
          'role', v_target_role,
          'name', v_target_name,
          'phone', v_target_phone,
          'deleted_bookings', v_deleted_bookings_count,
          'deleted_reviews', v_deleted_reviews_count,
          'deleted_at', now()
        )
      );
    exception when others then
      -- Do not block deletion if audit log insertion fails
      null;
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_id', target_profile_id,
    'role', v_target_role,
    'name', v_target_name,
    'phone', v_target_phone,
    'deleted_bookings', v_deleted_bookings_count,
    'deleted_reviews', v_deleted_reviews_count
  );
end;
$$;

-- Grant execution permissions
grant execute on function public.admin_delete_profile_permanently(text) to authenticated, anon, service_role;
