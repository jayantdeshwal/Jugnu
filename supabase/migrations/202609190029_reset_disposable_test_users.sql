-- Migration: 202609190029_reset_disposable_test_users.sql
-- Description: Safe reset of the four explicit disposable test accounts while strictly protecting the Super Admin.

BEGIN;

-- ============================================================================
-- 1. PRE-DELETION SAFETY ASSERTIONS
-- ============================================================================
DO $$
DECLARE
  v_sa_uuid uuid;
  v_sa_auth_email text;
  v_sa_profile_role public.user_role;
  v_disposable_ids uuid[] := ARRAY[
    'ec5cf7c7-3adb-40b7-9e4e-195e940f4d90'::uuid,
    'fd337c7e-cd68-46a1-a679-36f2a83cb87f'::uuid,
    'f5ba14c9-192f-4f8e-93ea-532edb552a3c'::uuid,
    '003aae75-2f61-44c4-bee7-e2b6e0660952'::uuid
  ];
  v_id uuid;
BEGIN
  -- A. Resolve authoritative Super Admin UUID
  v_sa_uuid := public.get_super_admin_uuid();
  IF v_sa_uuid IS NULL THEN
    RAISE EXCEPTION 'Safety check failed: Super Admin authoritative UUID could not be resolved.';
  END IF;

  -- B. Assert Super Admin exists in auth.users with exact email
  SELECT lower(email) INTO v_sa_auth_email
  FROM auth.users
  WHERE id = v_sa_uuid;

  IF v_sa_auth_email IS NULL OR v_sa_auth_email <> 'jayant.deshwal.56@gmail.com' THEN
    RAISE EXCEPTION 'Safety check failed: Super Admin auth user missing or email mismatch (found: %)', v_sa_auth_email;
  END IF;

  -- C. Assert Super Admin profile exists with exact role
  SELECT role INTO v_sa_profile_role
  FROM public.profiles
  WHERE id = v_sa_uuid;

  IF v_sa_profile_role IS NULL OR v_sa_profile_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Safety check failed: Super Admin profile missing or role mismatch (found: %)', v_sa_profile_role;
  END IF;

  -- D. Assert NONE of the disposable UUIDs match the Super Admin UUID
  FOREACH v_id IN ARRAY v_disposable_ids LOOP
    IF v_id = v_sa_uuid THEN
      RAISE EXCEPTION 'FATAL: Disposable list contains Super Admin UUID (%)! Aborting.', v_id;
    END IF;
  END LOOP;

  -- E. Assert NONE of the disposable UUIDs carry super_admin role
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = ANY(v_disposable_ids) AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'FATAL: A disposable UUID holds super_admin role! Aborting.';
  END IF;

  RAISE NOTICE 'Pre-deletion safety assertions passed. Super Admin UUID: %', v_sa_uuid;
END;
$$;

-- Create temporary table containing ONLY the 4 authorized disposable UUIDs
CREATE TEMP TABLE tmp_target_disposable_users (
  id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO tmp_target_disposable_users (id) VALUES
  ('ec5cf7c7-3adb-40b7-9e4e-195e940f4d90'::uuid),
  ('fd337c7e-cd68-46a1-a679-36f2a83cb87f'::uuid),
  ('f5ba14c9-192f-4f8e-93ea-532edb552a3c'::uuid),
  ('003aae75-2f61-44c4-bee7-e2b6e0660952'::uuid);

-- ============================================================================
-- 2. FK-SAFE DEPENDENCY-ORDERED DELETION
-- ============================================================================

-- A. Delete reviews referencing disposable test users
DELETE FROM public.reviews
WHERE customer_id IN (SELECT id FROM tmp_target_disposable_users)
   OR worker_id IN (SELECT id FROM tmp_target_disposable_users);

-- B. Delete bookings referencing disposable test users
DELETE FROM public.bookings
WHERE customer_id IN (SELECT id FROM tmp_target_disposable_users)
   OR worker_id IN (SELECT id FROM tmp_target_disposable_users);

-- C. Delete notifications for disposable test users
DELETE FROM public.notifications
WHERE user_id IN (SELECT id FROM tmp_target_disposable_users);

-- D. Delete worker service areas for disposable test workers
DELETE FROM public.worker_service_areas
WHERE worker_id IN (SELECT id FROM tmp_target_disposable_users);

-- E. Delete worker categories for disposable test workers
DELETE FROM public.worker_categories
WHERE worker_id IN (SELECT id FROM tmp_target_disposable_users);

-- F. Delete worker profiles for disposable test workers
DELETE FROM public.worker_profiles
WHERE id IN (SELECT id FROM tmp_target_disposable_users);

-- G. Note: Storage objects will be deleted via official Supabase Storage API
-- (Direct SQL DELETE on storage.objects is blocked by Supabase's storage.protect_delete() trigger)

-- H. Delete profiles for the exact disposable test users
DELETE FROM public.profiles
WHERE id IN (SELECT id FROM tmp_target_disposable_users)
  AND id <> public.get_super_admin_uuid();

-- I. Delete auth.users for the exact disposable test users
DELETE FROM auth.users
WHERE id IN (SELECT id FROM tmp_target_disposable_users)
  AND id <> public.get_super_admin_uuid()
  AND lower(email) <> 'jayant.deshwal.56@gmail.com';

-- ============================================================================
-- 3. POST-DELETION SAFETY ASSERTIONS
-- ============================================================================
DO $$
DECLARE
  v_sa_count integer;
  v_sa_profile_count integer;
  v_sa_role public.user_role;
  v_sa_email text;
  v_remaining_disposable integer;
  v_sa_avatar_count integer;
BEGIN
  -- A. Assert Super Admin exists exactly once in auth.users
  SELECT count(*), min(lower(email)) INTO v_sa_count, v_sa_email
  FROM auth.users
  WHERE id = public.get_super_admin_uuid();

  IF v_sa_count <> 1 OR v_sa_email <> 'jayant.deshwal.56@gmail.com' THEN
    RAISE EXCEPTION 'Post-deletion check failed: Super Admin auth.users record compromised (count: %, email: %)', v_sa_count, v_sa_email;
  END IF;

  -- B. Assert Super Admin profile exists exactly once with role = super_admin
  SELECT count(*), min(role) INTO v_sa_profile_count, v_sa_role
  FROM public.profiles
  WHERE id = public.get_super_admin_uuid();

  IF v_sa_profile_count <> 1 OR v_sa_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Post-deletion check failed: Super Admin profiles record compromised (count: %, role: %)', v_sa_profile_count, v_sa_role;
  END IF;

  -- C. Assert NONE of the disposable test accounts remain in auth.users or profiles
  SELECT count(*) INTO v_remaining_disposable
  FROM auth.users
  WHERE id IN (
    'ec5cf7c7-3adb-40b7-9e4e-195e940f4d90'::uuid,
    'fd337c7e-cd68-46a1-a679-36f2a83cb87f'::uuid,
    'f5ba14c9-192f-4f8e-93ea-532edb552a3c'::uuid,
    '003aae75-2f61-44c4-bee7-e2b6e0660952'::uuid
  );

  IF v_remaining_disposable <> 0 THEN
    RAISE EXCEPTION 'Post-deletion check failed: % disposable test user(s) still exist in auth.users!', v_remaining_disposable;
  END IF;

  SELECT count(*) INTO v_remaining_disposable
  FROM public.profiles
  WHERE id IN (
    'ec5cf7c7-3adb-40b7-9e4e-195e940f4d90'::uuid,
    'fd337c7e-cd68-46a1-a679-36f2a83cb87f'::uuid,
    'f5ba14c9-192f-4f8e-93ea-532edb552a3c'::uuid,
    '003aae75-2f61-44c4-bee7-e2b6e0660952'::uuid
  );

  IF v_remaining_disposable <> 0 THEN
    RAISE EXCEPTION 'Post-deletion check failed: % disposable test user(s) still exist in profiles!', v_remaining_disposable;
  END IF;

  -- D. Assert Super Admin storage object intact
  SELECT count(*) INTO v_sa_avatar_count
  FROM storage.objects
  WHERE name LIKE public.get_super_admin_uuid()::text || '/%';

  IF v_sa_avatar_count < 1 THEN
    RAISE EXCEPTION 'Post-deletion check failed: Super Admin avatar storage object was deleted!';
  END IF;

  RAISE NOTICE 'SUCCESS: Disposable test user reset complete. Super Admin is 100%% intact and verified.';
END;
$$;

COMMIT;
