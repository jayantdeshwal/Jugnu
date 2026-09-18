-- Migration: 202609180026_two_level_admin_lockdown.sql
-- Description: Implement Two-Level Admin Hierarchy (Super Admin & Sub Admin) and Critical Privilege Lockdown.
-- Resolves: JUGNU-SEC-01 (promote_to_admin backdoor), JUGNU-SEC-03 (profiles.role tampering), and Super Admin Authoritative UUID Binding.
-- Note: Requires 202609180025_add_admin_roles_enum.sql to be committed first.

BEGIN;

-- ============================================================================
-- STEP 1: RESOLVE FOUNDER UUID ONCE & PROVISION AUTHORITATIVE HELPER FUNCTION
-- ============================================================================
DO $$
DECLARE
  v_founder_id uuid;
BEGIN
  -- Resolve founder's actual auth.users.id once
  SELECT id INTO v_founder_id FROM auth.users WHERE lower(email) = 'jayant.deshwal.56@gmail.com' LIMIT 1;
  IF v_founder_id IS NULL THEN
    SELECT id INTO v_founder_id FROM public.profiles WHERE lower(email) = 'jayant.deshwal.56@gmail.com' LIMIT 1;
  END IF;

  -- Fallback to designated permanent founder UUID if no record exists yet
  IF v_founder_id IS NULL THEN
    v_founder_id := '3216cdd3-aaea-45ab-944c-cfb30d6a6e0b'::uuid;
  END IF;

  -- Define immutable getter for the authoritative Super Admin UUID
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.get_super_admin_uuid()
    RETURNS uuid
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    IMMUTABLE
    AS $body$
      SELECT %L::uuid;
    $body$;
  $fn$, v_founder_id);
END;
$$;

-- Secure get_super_admin_uuid: Revoke execution from untrusted anon/public clients
REVOKE EXECUTE ON FUNCTION public.get_super_admin_uuid() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_super_admin_uuid() TO authenticated, service_role;

-- Temporarily drop profile guard triggers so old triggers do not intercept migration data updates
DROP TRIGGER IF EXISTS trg_guard_profile_inserts ON public.profiles;
DROP TRIGGER IF EXISTS trg_guard_profile_updates ON public.profiles;
DROP TRIGGER IF EXISTS trg_guard_profile_deletions ON public.profiles;

-- Ensure designated founder profile exists and holds role = 'super_admin' bound to founder UUID
INSERT INTO public.profiles (id, full_name, email, phone, role, created_at, updated_at)
SELECT 
  id,
  coalesce(raw_user_meta_data->>'full_name', 'Jayant Deshwal (Super Admin)'),
  'jayant.deshwal.56@gmail.com',
  coalesce(phone, '+919876543210'),
  'super_admin',
  now(),
  now()
FROM auth.users
WHERE id = public.get_super_admin_uuid()
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin',
    email = 'jayant.deshwal.56@gmail.com',
    updated_at = timezone('utc', now());

UPDATE public.profiles
SET role = 'super_admin',
    updated_at = timezone('utc', now())
WHERE id = public.get_super_admin_uuid();

-- Migrate all other existing admin accounts to 'sub_admin'
UPDATE public.profiles
SET role = 'sub_admin',
    updated_at = timezone('utc', now())
WHERE role IN ('admin', 'super_admin')
  AND id <> public.get_super_admin_uuid();

-- Seed/elevate test sub_admin accounts for authenticated live verification
UPDATE public.profiles
SET role = 'sub_admin',
    updated_at = timezone('utc', now())
WHERE lower(email) IN ('phase2a_test_sub_admin@test.com', 'phase2a_test_sub_admin_2@test.com');

-- ============================================================================
-- STEP 2: ENFORCE EXACTLY ONE SUPER ADMIN VIA UNIQUE PARTIAL INDEX
-- ============================================================================
DROP INDEX IF EXISTS public.uq_profiles_single_super_admin;
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_single_super_admin
ON public.profiles (role)
WHERE role = 'super_admin';

-- ============================================================================
-- STEP 3: PERMANENTLY REMOVE UNRESTRICTED PROMOTE_TO_ADMIN (JUGNU-SEC-01)
-- ============================================================================
DROP FUNCTION IF EXISTS public.promote_to_admin(text);

-- ============================================================================
-- STEP 4: STRICT TWO-LEVEL ADMIN HELPER FUNCTIONS (AUTHORITATIVE UUID BOUND)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'sub_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
     AND auth.uid() = public.get_super_admin_uuid()
     AND EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'super_admin'
     );
$$;

CREATE OR REPLACE FUNCTION public.is_sub_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'sub_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_sub_admin() TO public, anon, authenticated, service_role;

-- ============================================================================
-- STEP 5: TRIGGER DEFENSE — GUARD PROFILE INSERTIONS (BEFORE INSERT)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_inserts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 0. Permit direct database administrator / SQL Editor executions (where session_user is postgres/supabase_admin)
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Disallow inserting legacy 'admin' role
  IF NEW.role = 'admin' THEN
    RAISE EXCEPTION 'Invalid role: The legacy admin role is discontinued. Administrator accounts must be sub_admin.';
  END IF;

  -- Disallow inserting super_admin unless it is specifically the designated authoritative UUID
  IF NEW.role = 'super_admin' THEN
    IF NEW.id <> public.get_super_admin_uuid() THEN
      RAISE EXCEPTION 'Action prohibited: The super_admin role is strictly reserved for the authoritative Super Administrator UUID.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin' AND id <> NEW.id) THEN
      RAISE EXCEPTION 'Action prohibited: Exactly one Super Administrator account is permitted.';
    END IF;
  END IF;

  -- Disallow inserting sub_admin directly unless caller is the Super Admin
  IF NEW.role = 'sub_admin' THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can create Sub Administrator profiles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_inserts ON public.profiles;
CREATE TRIGGER trg_guard_profile_inserts
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_inserts();

-- ============================================================================
-- STEP 6: TRIGGER DEFENSE — HARDEN PROFILES.ROLE AGAINST TAMPERING (BEFORE UPDATE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 0. Permit direct database administrator / SQL Editor executions (where session_user is postgres/supabase_admin)
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Prevent altering primary key ID
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile ID cannot be modified';
  END IF;

  -- 2. Reject legacy 'admin' role on any update
  IF NEW.role = 'admin' THEN
    RAISE EXCEPTION 'Invalid role: The legacy admin role is discontinued. Administrator accounts must be sub_admin.';
  END IF;

  -- 3. Protect Super Admin account immutability (cannot be demoted, renamed, transferred, or modified by others)
  IF OLD.id = public.get_super_admin_uuid() OR OLD.role = 'super_admin' THEN
    -- Nobody other than the Super Admin themselves can modify the Super Admin profile
    IF auth.uid() IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Action prohibited: Sub Administrators cannot modify the Super Administrator profile.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be demoted or have its role modified.';
    END IF;
    IF lower(NEW.email) IS DISTINCT FROM lower(OLD.email) THEN
      RAISE EXCEPTION 'Action prohibited: The Super Administrator identity cannot be transferred or altered.';
    END IF;
  END IF;

  -- 4. Guard all role modifications
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Super Admin role can NEVER be granted to anyone else
    IF NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'Action prohibited: The super_admin role is strictly reserved for the authoritative Super Administrator.';
    END IF;

    -- Sub Admin role can ONLY be granted or removed by the Super Admin
    IF NEW.role = 'sub_admin' OR OLD.role = 'sub_admin' THEN
      IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can assign or modify Sub Administrator roles.';
      END IF;
    -- Worker role can be granted by an administrator OR via official register_worker() RPC
    ELSIF NEW.role = 'worker' THEN
      IF NOT (public.is_admin() OR current_setting('jugnu.worker_registration_in_progress', true) = 'true') THEN
        RAISE EXCEPTION 'Unauthorized: Role cannot be modified directly.';
      END IF;
    -- All other role modifications require administrator privileges
    ELSIF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change user roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_updates ON public.profiles;
CREATE TRIGGER trg_guard_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_updates();

-- ============================================================================
-- STEP 7: TRIGGER DEFENSE — PREVENT SUPER ADMIN DELETION (BEFORE DELETE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_deletions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 0. Permit direct database administrator / SQL Editor executions (where session_user is postgres/supabase_admin)
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;

  -- Super Admin can NEVER be deleted
  IF OLD.id = public.get_super_admin_uuid() OR OLD.role = 'super_admin' THEN
    RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be deleted.';
  END IF;

  -- Deleting a sub_admin or legacy admin requires Super Admin privileges
  IF OLD.role IN ('sub_admin', 'admin') THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can delete administrator accounts.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_deletions ON public.profiles;
CREATE TRIGGER trg_guard_profile_deletions
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_deletions();

-- ============================================================================
-- STEP 8: TRIGGER DEFENSE — PROTECT SUPER ADMIN IN AUTH.USERS (DISABLE/DELETE GUARD)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_auth_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_sa_uuid uuid;
BEGIN
  BEGIN
    v_sa_uuid := public.get_super_admin_uuid();
  EXCEPTION WHEN others THEN
    v_sa_uuid := NULL;
  END;

  IF v_sa_uuid IS NOT NULL AND OLD.id = v_sa_uuid THEN
    -- 1. Hard block on DELETE
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Action prohibited: The Super Administrator authentication record cannot be deleted.';
    END IF;

    -- 2. Hard block on destructive/disabling UPDATEs
    IF TG_OP = 'UPDATE' THEN
      -- A. Prevent primary key mutation
      IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Action prohibited: The Super Administrator primary key ID cannot be modified.';
      END IF;

      -- B. Prevent email alteration / transfer
      IF lower(NEW.email) IS DISTINCT FROM lower(OLD.email) THEN
        RAISE EXCEPTION 'Action prohibited: The Super Administrator email identity cannot be altered.';
      END IF;

      -- C. Prevent disable/ban via banned_until
      IF NEW.banned_until IS DISTINCT FROM OLD.banned_until AND NEW.banned_until > now() THEN
        RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be banned or disabled.';
      END IF;

      -- D. Prevent soft-deletion via deleted_at
      IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be soft-deleted.';
      END IF;

      -- E. Prevent email confirmation revocation
      IF OLD.email_confirmed_at IS NOT NULL AND NEW.email_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Action prohibited: The Super Administrator email confirmation cannot be revoked.';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_auth_super_admin ON auth.users;
CREATE TRIGGER trg_guard_auth_super_admin
BEFORE UPDATE OR DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.guard_auth_super_admin();

-- ============================================================================
-- STEP 9: INSTRUMENT REGISTER_WORKER RPC WITH TRANSACTION FLAG
-- ============================================================================
CREATE OR REPLACE FUNCTION public.register_worker(
  worker_name text,
  worker_phone text,
  worker_bio text,
  worker_experience integer,
  worker_category_id text,
  worker_area_pincodes text[],
  worker_avatar_url text default null,
  worker_id_proof_url text default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  area_ids uuid[];
  requested_area_count integer;
  matched_area_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to register as a worker';
  END IF;

  IF nullif(trim(worker_name), '') IS NULL THEN
    RAISE EXCEPTION 'Worker name is required';
  END IF;

  IF worker_experience < 0 OR worker_experience > 50 THEN
    RAISE EXCEPTION 'Experience must be between 0 and 50 years';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = worker_category_id) THEN
    RAISE EXCEPTION 'Selected category is invalid';
  END IF;

  requested_area_count := coalesce(array_length(worker_area_pincodes, 1), 0);
  SELECT array_agg(id ORDER BY pincode), count(*)::integer
    INTO area_ids, matched_area_count
  FROM public.service_areas
  WHERE pincode = ANY(worker_area_pincodes);

  IF requested_area_count = 0 OR matched_area_count <> requested_area_count THEN
    RAISE EXCEPTION 'One or more service areas are invalid';
  END IF;

  -- Set transaction-local configuration flag to permit role transition to worker
  PERFORM set_config('jugnu.worker_registration_in_progress', 'true', true);

  -- Update profiles with name, phone, role, and optional avatar_url
  UPDATE public.profiles
  SET
    full_name = trim(worker_name),
    phone = nullif(trim(worker_phone), ''),
    role = 'worker',
    avatar_url = coalesce(nullif(trim(worker_avatar_url), ''), avatar_url),
    updated_at = timezone('utc', now())
  WHERE id = auth.uid();

  -- Upsert worker_profiles with bio, experience, and optional id_proof_url
  INSERT INTO public.worker_profiles (
    id,
    bio,
    experience_years,
    approval_status,
    rejection_reason,
    is_available,
    id_proof_url,
    updated_at
  ) VALUES (
    auth.uid(),
    coalesce(worker_bio, ''),
    worker_experience,
    'pending',
    null,
    true,
    nullif(trim(worker_id_proof_url), ''),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    bio = excluded.bio,
    experience_years = excluded.experience_years,
    approval_status = 'pending',
    rejection_reason = null,
    id_proof_url = coalesce(excluded.id_proof_url, public.worker_profiles.id_proof_url),
    updated_at = timezone('utc', now());

  -- Update categories
  DELETE FROM public.worker_categories WHERE worker_id = auth.uid();
  INSERT INTO public.worker_categories (worker_id, category_id)
  VALUES (auth.uid(), worker_category_id);

  -- Update service areas
  DELETE FROM public.worker_service_areas WHERE worker_id = auth.uid();
  INSERT INTO public.worker_service_areas (worker_id, service_area_id)
  SELECT auth.uid(), unnest(area_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_worker(text, text, text, integer, text, text[], text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_worker(text, text, text, integer, text, text[], text, text) TO authenticated, service_role;

-- ============================================================================
-- STEP 10: HARDENED SUB ADMIN PROVISIONING (SUPER ADMIN ONLY)
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_create_sub_admin(text, text, text, text);
CREATE OR REPLACE FUNCTION public.admin_create_sub_admin(
  admin_email text,
  admin_password text,
  admin_full_name text,
  admin_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id uuid;
  v_clean_email text;
  v_clean_phone text;
  v_user_id uuid;
  v_existing_role public.user_role;
BEGIN
  v_caller_id := auth.uid();

  -- 1. Strict Security Guard: Only the Super Administrator can provision Sub Administrators
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can provision Sub Administrator accounts.';
  END IF;

  -- 2. Validate Inputs
  v_clean_email := lower(trim(admin_email));
  IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%_@__%.__%' THEN
    RAISE EXCEPTION 'Please provide a valid email address for the new administrator.';
  END IF;

  -- Prevent targeting the Super Admin account
  IF v_clean_email = 'jayant.deshwal.56@gmail.com' THEN
    RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be targeted or reprovisioned.';
  END IF;

  IF admin_password IS NULL OR length(admin_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  IF admin_full_name IS NULL OR trim(admin_full_name) = '' THEN
    RAISE EXCEPTION 'Please provide the full name of the new administrator.';
  END IF;

  -- Format phone (+91XXXXXXXXXX)
  v_clean_phone := regexp_replace(coalesce(admin_phone, ''), '\D', '', 'g');
  IF length(v_clean_phone) >= 10 THEN
    v_clean_phone := '+91' || right(v_clean_phone, 10);
  ELSE
    RAISE EXCEPTION 'Please provide a valid 10-digit mobile number for mandatory 2FA OTP.';
  END IF;

  -- 3. Check if user already exists in public.profiles
  SELECT id, role INTO v_user_id, v_existing_role
  FROM public.profiles
  WHERE lower(email) = v_clean_email;

  IF v_user_id = public.get_super_admin_uuid() OR v_existing_role = 'super_admin' THEN
    RAISE EXCEPTION 'Action prohibited: Cannot alter the Super Administrator account.';
  ELSIF v_existing_role IN ('sub_admin', 'admin') THEN
    RAISE EXCEPTION 'An administrator account with email % already exists.', v_clean_email;
  END IF;

  -- 4. Check if user exists in auth.users
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_clean_email;
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Account already exists as customer/worker: elevate profile role to sub_admin WITHOUT touching auth credentials
    UPDATE public.profiles
    SET role = 'sub_admin',
        full_name = trim(admin_full_name),
        phone = v_clean_phone,
        email = v_clean_email,
        updated_at = timezone('utc', now())
    WHERE id = v_user_id;
  ELSE
    -- Completely new user: Provision auth user and profile
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_clean_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', trim(admin_full_name)),
      now(),
      now(),
      '',
      ''
    );

    INSERT INTO public.profiles (
      id,
      full_name,
      email,
      phone,
      role,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      trim(admin_full_name),
      v_clean_email,
      v_clean_phone,
      'sub_admin',
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'sub_admin',
        full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        updated_at = now();
  END IF;

  -- 5. Audit Logging in admin_actions
  INSERT INTO public.admin_actions (
    admin_id,
    action,
    target_table,
    target_id,
    details
  ) VALUES (
    v_caller_id,
    'provision_sub_admin',
    'profiles',
    v_user_id,
    jsonb_build_object(
      'new_admin_email', v_clean_email,
      'new_admin_name', trim(admin_full_name),
      'new_admin_phone', v_clean_phone,
      'created_by_admin_id', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_clean_email,
    'role', 'sub_admin',
    'message', 'Sub-Administrator account successfully provisioned.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_sub_admin(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_sub_admin(text, text, text, text) TO authenticated, service_role;

-- ============================================================================
-- STEP 11: SUB ADMIN DEMOTION RPC (SUPER ADMIN ONLY)
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_demote_sub_admin(uuid);
CREATE OR REPLACE FUNCTION public.admin_demote_sub_admin(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_role public.user_role;
  v_target_email text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can demote Sub Administrators.';
  END IF;

  SELECT role, email INTO v_target_role, v_target_email
  FROM public.profiles
  WHERE id = target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF target_user_id = public.get_super_admin_uuid() OR v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be demoted.';
  END IF;

  IF v_target_role <> 'sub_admin' AND v_target_role <> 'admin' THEN
    RAISE EXCEPTION 'Target user is not a Sub Administrator.';
  END IF;

  UPDATE public.profiles
  SET role = 'customer',
      updated_at = timezone('utc', now())
  WHERE id = target_user_id;

  INSERT INTO public.admin_actions (
    admin_id,
    action,
    target_table,
    target_id,
    details
  ) VALUES (
    auth.uid(),
    'demote_sub_admin',
    'profiles',
    target_user_id,
    jsonb_build_object('demoted_email', v_target_email)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sub-Administrator successfully demoted to Customer.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_demote_sub_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_demote_sub_admin(uuid) TO authenticated, service_role;

-- ============================================================================
-- STEP 12: TEAM LISTING RPC (STRICTLY SUPER_ADMIN AND SUB_ADMIN)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_admin_team();
CREATE OR REPLACE FUNCTION public.get_admin_team()
RETURNS table (
  id uuid,
  full_name text,
  email text,
  phone text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can view the administrator team list.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.role::text,
    p.created_at
  FROM public.profiles p
  WHERE p.role IN ('super_admin', 'sub_admin')
  ORDER BY 
    CASE WHEN p.role = 'super_admin' THEN 1 ELSE 2 END,
    p.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_team() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_team() TO authenticated, service_role;

-- ============================================================================
-- STEP 13: HARDENED ACCOUNT DELETION RPC
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_delete_profile_permanently(text);
DROP FUNCTION IF EXISTS public.admin_delete_profile_permanently(uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_profile_permanently(target_profile_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_target_uuid uuid;
  v_target_role text;
  v_target_name text;
  v_target_phone text;
  v_target_email text;
BEGIN
  v_admin_id := auth.uid();

  -- 1. Security Check: Caller must be an administrator
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can permanently delete accounts.';
  END IF;

  -- 2. Validate and convert UUID
  BEGIN
    v_target_uuid := target_profile_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid profile ID format: %', target_profile_id;
  END;

  -- 3. Safety Check: Cannot delete yourself
  IF v_target_uuid = v_admin_id THEN
    RAISE EXCEPTION 'Action prohibited: Administrators cannot delete their own profile from the admin console.';
  END IF;

  -- 4. Verify target profile exists in public.profiles
  SELECT role::text, full_name, phone, email
  INTO v_target_role, v_target_name, v_target_phone, v_target_email
  FROM public.profiles
  WHERE id = v_target_uuid;

  -- 5. IMMUTABLE SUPER ADMIN PROTECTION: Cannot be deleted by anyone
  IF v_target_uuid = public.get_super_admin_uuid() OR v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be deleted.';
  END IF;

  -- 6. Sub Admin protection: Only Super Admin can delete Sub Admins
  IF v_target_role IN ('sub_admin', 'admin') THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Action prohibited: Only the Super Administrator can delete administrator accounts.';
    END IF;
  END IF;

  -- 7. Execute cascade delete
  DELETE FROM public.complaints WHERE opened_by = v_target_uuid OR against_user = v_target_uuid;
  DELETE FROM public.reviews WHERE customer_id = v_target_uuid OR worker_id = v_target_uuid;
  DELETE FROM public.notifications WHERE user_id = v_target_uuid;
  DELETE FROM public.bookings WHERE customer_id = v_target_uuid OR worker_id = v_target_uuid;
  DELETE FROM public.worker_service_areas WHERE worker_id = v_target_uuid;
  DELETE FROM public.worker_categories WHERE worker_id = v_target_uuid;
  DELETE FROM public.worker_profiles WHERE id = v_target_uuid;
  DELETE FROM public.admin_actions WHERE admin_id = v_target_uuid;
  DELETE FROM public.profiles WHERE id = v_target_uuid;
  DELETE FROM auth.users WHERE id = v_target_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile successfully deleted permanently.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_profile_permanently(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_profile_permanently(text) TO authenticated, service_role;

-- ============================================================================
-- STEP 14: PROFILES RLS UPDATE POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- ============================================================================
-- STEP 15: AUDIT & HARDEN ALL REMAINING ADMIN RPC GRANTS
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.review_worker(uuid, public.worker_approval_status, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_worker(uuid, public.worker_approval_status, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_workers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_workers() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_customers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_customers() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_notifications(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_notifications(integer) TO authenticated, service_role;

COMMIT;
