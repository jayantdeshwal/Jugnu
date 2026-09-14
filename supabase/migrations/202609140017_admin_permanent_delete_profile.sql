-- Phase 10: Admin Permanent Profile Deletion
-- Allows verified administrators to permanently remove a worker or customer profile from the platform,
-- safely cascading through all foreign-key dependencies (bookings, reviews, complaints, notifications, categories, auth).

create or replace function public.admin_delete_profile_permanently(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid;
  v_target_role public.user_role;
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

  -- 2. Verify target profile exists
  select role, full_name, phone
  into v_target_role, v_target_name, v_target_phone
  from public.profiles
  where id = target_profile_id;

  if not found then
    raise exception 'Profile not found with ID: %', target_profile_id;
  end if;

  -- 3. Safety Check: Cannot delete yourself
  if target_profile_id = v_admin_id then
    raise exception 'Action prohibited: Administrators cannot delete their own profile from the admin console.';
  end if;

  -- 4. Safety Check: Cannot delete another admin
  if v_target_role = 'admin' then
    raise exception 'Action prohibited: Cannot delete another administrator profile.';
  end if;

  -- 5. Cascade Delete: Complaints (where user is complainant, respondent, or related booking)
  delete from public.complaints
  where opened_by = target_profile_id
     or against_user = target_profile_id
     or booking_id in (
       select id from public.bookings
       where customer_id = target_profile_id or worker_id = target_profile_id
     );

  -- 6. Cascade Delete: Reviews (where user is reviewer, reviewee, or related booking)
  with del_reviews as (
    delete from public.reviews
    where customer_id = target_profile_id
       or worker_id = target_profile_id
       or booking_id in (
         select id from public.bookings
         where customer_id = target_profile_id or worker_id = target_profile_id
       )
    returning id
  )
  select count(*) into v_deleted_reviews_count from del_reviews;

  -- 7. Cascade Delete: Notifications (for this user or related bookings)
  delete from public.notifications
  where user_id = target_profile_id
     or booking_id in (
       select id from public.bookings
       where customer_id = target_profile_id or worker_id = target_profile_id
     );

  -- 8. Cascade Delete: Bookings (where user is customer or worker)
  with del_bookings as (
    delete from public.bookings
    where customer_id = target_profile_id
       or worker_id = target_profile_id
    returning id
  )
  select count(*) into v_deleted_bookings_count from del_bookings;

  -- 9. If Target is a Worker: Remove service areas, categories, and worker_profile
  delete from public.worker_service_areas where worker_id = target_profile_id;
  delete from public.worker_categories where worker_id = target_profile_id;
  delete from public.worker_profiles where id = target_profile_id;

  -- 10. Delete the core profile row
  delete from public.profiles where id = target_profile_id;

  -- 11. Delete from auth.users if account was registered via Supabase Auth
  -- (Prevents stale authentication sessions or re-login attempts)
  delete from auth.users where id = target_profile_id;

  -- 12. Audit Log in admin_actions
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
    target_profile_id,
    jsonb_build_object(
      'role', v_target_role,
      'name', v_target_name,
      'phone', v_target_phone,
      'deleted_bookings', v_deleted_bookings_count,
      'deleted_reviews', v_deleted_reviews_count,
      'deleted_at', now()
    )
  );

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

-- Grant execution to authenticated users (function performs internal role check)
grant execute on function public.admin_delete_profile_permanently(uuid) to authenticated;
