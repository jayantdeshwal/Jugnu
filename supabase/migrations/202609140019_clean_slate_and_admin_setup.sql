-- Migration: 202609140019_clean_slate_and_admin_setup.sql
-- Description: Production database clean slate & real administrator setup.
-- Purges all test data, demo workers, test customers, and mock bookings,
-- while preserving core system tables (categories, service areas) and providing
-- admin elevation tools.

-- ============================================================================
-- 1. FUNCTION: Promote Any User to Administrator by Email
-- ============================================================================
create or replace function public.promote_to_admin(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_email text;
  v_profile_id uuid;
  v_auth_id uuid;
  v_updated_rows int := 0;
begin
  v_target_email := lower(trim(target_email));

  if v_target_email is null or v_target_email = '' then
    raise exception 'Target email cannot be empty';
  end if;

  -- 1. Look up user in auth.users
  select id into v_auth_id
  from auth.users
  where lower(email) = v_target_email;

  -- 2. Look up in public.profiles
  select id into v_profile_id
  from public.profiles
  where lower(email) = v_target_email or id = v_auth_id;

  if v_profile_id is not null then
    -- Elevate existing profile
    update public.profiles
    set role = 'admin',
        updated_at = timezone('utc', now())
    where id = v_profile_id;
    get diagnostics v_updated_rows = row_count;
  elsif v_auth_id is not null then
    -- Create/upsert profile for the auth user
    insert into public.profiles (id, full_name, email, role)
    values (v_auth_id, 'Platform Administrator', v_target_email, 'admin')
    on conflict (id) do update
    set role = 'admin',
        email = excluded.email,
        updated_at = timezone('utc', now());
    v_updated_rows := 1;
    v_profile_id := v_auth_id;
  else
    return jsonb_build_object(
      'success', false,
      'message', 'User account with email ' || target_email || ' has not signed up in Supabase Auth yet. Please sign up or create the user in Supabase Authentication, then run: SELECT public.promote_to_admin(''' || target_email || ''');'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'email', v_target_email,
    'role', 'admin',
    'message', 'User successfully promoted to platform administrator.'
  );
end;
$$;

-- Grant execution permission
grant execute on function public.promote_to_admin(text) to authenticated, service_role, anon;

-- ============================================================================
-- 2. CLEAN SLATE PURGE SCRIPT
-- RUN THE FOLLOWING QUERIES IN SUPABASE SQL EDITOR TO WIPE ALL TEST/DEMO ACCOUNTS:
-- ============================================================================

-- Step A: Remove all test complaints, reviews, notifications, and bookings
delete from public.complaints;
delete from public.reviews;
delete from public.notifications;
delete from public.bookings;

-- Step B: Remove all test worker profiles, service areas, and categories
delete from public.worker_service_areas;
delete from public.worker_categories;
delete from public.worker_profiles;

-- Step C: Remove audit logs and test profiles
delete from public.admin_actions;
delete from public.profiles;

-- Step D: Clean out all test authentication accounts from auth.users
delete from auth.users;

-- ============================================================================
-- 3. READY FOR REAL ADMIN
-- After running the cleanup above, create your real admin user either by:
-- Option 1: Register in the app (or in Supabase Dashboard > Authentication > Users)
-- Option 2: Execute the following query after creating the account:
--
--   SELECT public.promote_to_admin('jayant.deshwal.56@gmail.com');
--
-- ============================================================================
