-- Migration: 202609200031_admin_2fa_sessions.sql
-- Description: Server-side 30-minute admin 2FA authorization bound to Supabase JWT session_id.
-- Covers: admin_2fa_sessions table, require_admin_2fa(), is_admin_2fa_active(), revoke_admin_2fa(),
--         phone immutability hardening, and 2FA enforcement on all privileged admin RPCs.

BEGIN;

-- ============================================================================
-- 1. ADMIN 2FA SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_2fa_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    text        NOT NULL,
  verified_at   timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_admin_2fa_session UNIQUE (admin_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_2fa_sessions_admin_id   ON public.admin_2fa_sessions (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_2fa_sessions_session_id ON public.admin_2fa_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_admin_2fa_sessions_expires_at ON public.admin_2fa_sessions (expires_at);

-- RLS: enable but deny all direct client access
ALTER TABLE public.admin_2fa_sessions ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: only service_role (Edge Function) may write rows.
-- Authenticated users may read their own row only (needed for is_admin_2fa_active RPC fallback).
DROP POLICY IF EXISTS "Admin can read own 2fa session" ON public.admin_2fa_sessions;
CREATE POLICY "Admin can read own 2fa session"
  ON public.admin_2fa_sessions FOR SELECT
  USING (admin_id = auth.uid());

-- Revoke all direct write access from clients
REVOKE INSERT, UPDATE, DELETE ON public.admin_2fa_sessions FROM authenticated, anon, public;
GRANT SELECT ON public.admin_2fa_sessions TO authenticated;
GRANT ALL ON public.admin_2fa_sessions TO service_role;

-- ============================================================================
-- 2. HELPER: EXTRACT session_id FROM CURRENT JWT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_jwt_session_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'session_id',
    ''
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_jwt_session_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_jwt_session_id() TO authenticated, service_role;

-- ============================================================================
-- 3. CENTRAL GUARD: require_admin_2fa()
-- Raises exception if caller lacks an active 30-minute 2FA authorization.
-- Called as first statement in every privileged admin RPC.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.require_admin_2fa()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_session_id text;
  v_expires_at timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required.';
  END IF;

  -- Verify caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
  END IF;

  v_session_id := public.get_jwt_session_id();
  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: JWT session_id missing. Please sign in again.';
  END IF;

  -- Look up active 2FA record bound to this exact (admin_id, session_id) pair
  SELECT expires_at INTO v_expires_at
  FROM public.admin_2fa_sessions
  WHERE admin_id   = v_uid
    AND session_id = v_session_id
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin 2FA authorization required or expired. Please complete 2FA verification.';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.require_admin_2fa() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.require_admin_2fa() TO authenticated, service_role;

-- ============================================================================
-- 4. STATUS CHECK: is_admin_2fa_active()
-- Returns true if the current session has an active 2FA authorization.
-- Used by AdminDashboard on mount to decide whether to show 2FA prompt.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_2fa_active()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_session_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_admin() THEN
    RETURN false;
  END IF;

  v_session_id := public.get_jwt_session_id();
  IF v_session_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_2fa_sessions
    WHERE admin_id   = v_uid
      AND session_id = v_session_id
      AND expires_at > now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_2fa_active() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_2fa_active() TO authenticated, service_role;

-- ============================================================================
-- 5. REVOCATION: revoke_admin_2fa()
-- Deletes the 2FA record for the current (admin_id, session_id).
-- Called during admin logout.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_admin_2fa()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_session_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_session_id := public.get_jwt_session_id();
  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.admin_2fa_sessions
  WHERE admin_id   = v_uid
    AND session_id = v_session_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_admin_2fa() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revoke_admin_2fa() TO authenticated, service_role;

-- ============================================================================
-- 6. PROTECT ALL PRIVILEGED ADMIN RPCs WITH require_admin_2fa()
-- ============================================================================

-- 6a. review_worker
CREATE OR REPLACE FUNCTION public.review_worker(
  target_worker_id uuid,
  decision public.worker_approval_status,
  decision_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin_2fa();

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can review worker registrations.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.worker_profiles WHERE id = target_worker_id) THEN
    RAISE EXCEPTION 'Worker profile not found.';
  END IF;

  UPDATE public.worker_profiles
  SET
    approval_status  = decision,
    rejection_reason = CASE WHEN decision = 'rejected' THEN decision_reason ELSE NULL END,
    updated_at       = timezone('utc', now())
  WHERE id = target_worker_id;

  INSERT INTO public.admin_actions (admin_id, action, target_table, target_id, details)
  VALUES (
    auth.uid(),
    'review_worker_' || decision::text,
    'worker_profiles',
    target_worker_id,
    jsonb_build_object('decision', decision, 'reason', decision_reason)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_worker(uuid, public.worker_approval_status, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_worker(uuid, public.worker_approval_status, text) TO authenticated, service_role;

-- 6b. admin_delete_profile_permanently — add 2FA guard
CREATE OR REPLACE FUNCTION public.admin_delete_profile_permanently(target_profile_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id    uuid;
  v_target_uuid uuid;
  v_target_role text;
  v_target_name text;
  v_target_phone text;
  v_target_email text;
BEGIN
  PERFORM public.require_admin_2fa();

  v_admin_id := auth.uid();

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can permanently delete accounts.';
  END IF;

  BEGIN
    v_target_uuid := target_profile_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid profile ID format: %', target_profile_id;
  END;

  IF v_target_uuid = v_admin_id THEN
    RAISE EXCEPTION 'Action prohibited: Administrators cannot delete their own profile from the admin console.';
  END IF;

  SELECT role::text, full_name, phone, email
  INTO v_target_role, v_target_name, v_target_phone, v_target_email
  FROM public.profiles
  WHERE id = v_target_uuid;

  IF v_target_uuid = public.get_super_admin_uuid() OR v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be deleted.';
  END IF;

  IF v_target_role IN ('sub_admin', 'admin') THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Action prohibited: Only the Super Administrator can delete administrator accounts.';
    END IF;
  END IF;

  DELETE FROM public.complaints       WHERE opened_by = v_target_uuid OR against_user = v_target_uuid;
  DELETE FROM public.reviews          WHERE customer_id = v_target_uuid OR worker_id = v_target_uuid;
  DELETE FROM public.notifications    WHERE user_id = v_target_uuid;
  DELETE FROM public.bookings         WHERE customer_id = v_target_uuid OR worker_id = v_target_uuid;
  DELETE FROM public.worker_service_areas WHERE worker_id = v_target_uuid;
  DELETE FROM public.worker_categories    WHERE worker_id = v_target_uuid;
  DELETE FROM public.worker_profiles      WHERE id = v_target_uuid;
  DELETE FROM public.admin_actions        WHERE admin_id = v_target_uuid;
  -- Clean up any 2FA sessions for the deleted user
  DELETE FROM public.admin_2fa_sessions   WHERE admin_id = v_target_uuid;
  DELETE FROM public.profiles             WHERE id = v_target_uuid;
  DELETE FROM auth.users                  WHERE id = v_target_uuid;

  RETURN jsonb_build_object('success', true, 'message', 'Profile successfully deleted permanently.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_profile_permanently(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_profile_permanently(text) TO authenticated, service_role;

-- 6c. admin_create_sub_admin — add 2FA guard (Super Admin only, already checked inside)
CREATE OR REPLACE FUNCTION public.admin_create_sub_admin(
  admin_email     text,
  admin_password  text,
  admin_full_name text,
  admin_phone     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id      uuid;
  v_clean_email    text;
  v_clean_phone    text;
  v_user_id        uuid;
  v_existing_role  public.user_role;
BEGIN
  PERFORM public.require_admin_2fa();

  v_caller_id := auth.uid();

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can provision Sub Administrator accounts.';
  END IF;

  v_clean_email := lower(trim(admin_email));
  IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%_@__%.__%' THEN
    RAISE EXCEPTION 'Please provide a valid email address for the new administrator.';
  END IF;

  IF v_clean_email = 'jayant.deshwal.56@gmail.com' THEN
    RAISE EXCEPTION 'Action prohibited: The Super Administrator account cannot be targeted or reprovisioned.';
  END IF;

  IF admin_password IS NULL OR length(admin_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  IF admin_full_name IS NULL OR trim(admin_full_name) = '' THEN
    RAISE EXCEPTION 'Please provide the full name of the new administrator.';
  END IF;

  v_clean_phone := regexp_replace(coalesce(admin_phone, ''), '\D', '', 'g');
  IF length(v_clean_phone) >= 10 THEN
    v_clean_phone := '+91' || right(v_clean_phone, 10);
  ELSE
    RAISE EXCEPTION 'Please provide a valid 10-digit mobile number for mandatory 2FA OTP.';
  END IF;

  SELECT id, role INTO v_user_id, v_existing_role
  FROM public.profiles
  WHERE lower(email) = v_clean_email;

  IF v_user_id = public.get_super_admin_uuid() OR v_existing_role = 'super_admin' THEN
    RAISE EXCEPTION 'Action prohibited: Cannot alter the Super Administrator account.';
  ELSIF v_existing_role IN ('sub_admin', 'admin') THEN
    RAISE EXCEPTION 'An administrator account with email % already exists.', v_clean_email;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_email;
  END IF;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'sub_admin', full_name = trim(admin_full_name),
        phone = v_clean_phone, email = v_clean_email,
        updated_at = timezone('utc', now())
    WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_clean_email, crypt(admin_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', trim(admin_full_name)),
      now(), now(), '', ''
    );
    INSERT INTO public.profiles (id, full_name, email, phone, role, created_at, updated_at)
    VALUES (v_user_id, trim(admin_full_name), v_clean_email, v_clean_phone, 'sub_admin', now(), now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'sub_admin', full_name = excluded.full_name,
        email = excluded.email, phone = excluded.phone, updated_at = now();
  END IF;

  INSERT INTO public.admin_actions (admin_id, action, target_table, target_id, details)
  VALUES (v_caller_id, 'provision_sub_admin', 'profiles', v_user_id,
    jsonb_build_object('new_admin_email', v_clean_email, 'new_admin_name', trim(admin_full_name),
                       'new_admin_phone', v_clean_phone, 'created_by_admin_id', v_caller_id));

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id,
    'email', v_clean_email, 'role', 'sub_admin',
    'message', 'Sub-Administrator account successfully provisioned.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_sub_admin(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_sub_admin(text, text, text, text) TO authenticated, service_role;

-- 6d. admin_demote_sub_admin — add 2FA guard
CREATE OR REPLACE FUNCTION public.admin_demote_sub_admin(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_role  public.user_role;
  v_target_email text;
BEGIN
  PERFORM public.require_admin_2fa();

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can demote Sub Administrators.';
  END IF;

  SELECT role, email INTO v_target_role, v_target_email
  FROM public.profiles WHERE id = target_user_id;

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
  SET role = 'customer', updated_at = timezone('utc', now())
  WHERE id = target_user_id;

  -- Revoke any active 2FA sessions for the demoted admin
  DELETE FROM public.admin_2fa_sessions WHERE admin_id = target_user_id;

  INSERT INTO public.admin_actions (admin_id, action, target_table, target_id, details)
  VALUES (auth.uid(), 'demote_sub_admin', 'profiles', target_user_id,
    jsonb_build_object('demoted_email', v_target_email));

  RETURN jsonb_build_object('success', true, 'message', 'Sub-Administrator successfully demoted to Customer.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_demote_sub_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_demote_sub_admin(uuid) TO authenticated, service_role;

-- 6e. get_admin_team — read-only, requires admin role only (no 2FA — non-sensitive listing)
-- Already protected by is_admin() check inside. No 2FA required for read-only team listing.
-- (Intentionally left without 2FA guard — see final report section 5.)

-- 6f. get_admin_workers — add 2FA guard (exposes PII: phone numbers)
-- DROP first because return type changes (approval_status text vs enum)
DROP FUNCTION IF EXISTS public.get_admin_workers();
CREATE OR REPLACE FUNCTION public.get_admin_workers()
RETURNS TABLE (
  id               uuid,
  name             text,
  phone            text,
  avatar_url       text,
  id_proof_url     text,
  bio              text,
  experience_years integer,
  approval_status  text,
  is_available     boolean,
  rating           numeric,
  review_count     integer,
  rejection_reason text,
  created_at       timestamptz,
  categories       text[],
  areas            text[],
  completed_jobs   bigint,
  total_bookings   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin_2fa();

  RETURN QUERY
  SELECT
    wp.id,
    p.full_name::text                                                    AS name,
    p.phone::text                                                        AS phone,
    p.avatar_url::text                                                   AS avatar_url,
    wp.id_proof_url::text                                                AS id_proof_url,
    wp.bio::text                                                         AS bio,
    wp.experience_years,
    wp.approval_status::text                                             AS approval_status,
    wp.is_available,
    COALESCE(wp.rating, 0)::numeric                                      AS rating,
    COALESCE(wp.review_count, 0)                                         AS review_count,
    wp.rejection_reason::text                                            AS rejection_reason,
    wp.created_at,
    COALESCE(ARRAY_AGG(DISTINCT wc.category_id) FILTER (WHERE wc.category_id IS NOT NULL), '{}') AS categories,
    COALESCE(ARRAY_AGG(DISTINCT sa.pincode)     FILTER (WHERE sa.pincode IS NOT NULL),     '{}') AS areas,
    COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'completed')          AS completed_jobs,
    COUNT(DISTINCT b.id)                                                 AS total_bookings
  FROM public.worker_profiles wp
  JOIN public.profiles p ON p.id = wp.id
  LEFT JOIN public.worker_categories wc ON wc.worker_id = wp.id
  LEFT JOIN public.worker_service_areas wsa ON wsa.worker_id = wp.id
  LEFT JOIN public.service_areas sa ON sa.id = wsa.service_area_id
  LEFT JOIN public.bookings b ON b.worker_id = wp.id
  GROUP BY wp.id, p.full_name, p.phone, p.avatar_url, wp.id_proof_url,
           wp.bio, wp.experience_years, wp.approval_status, wp.is_available,
           wp.rating, wp.review_count, wp.rejection_reason, wp.created_at
  ORDER BY wp.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_workers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_workers() TO authenticated, service_role;

-- 6g. get_admin_customers — add 2FA guard (exposes PII: phone numbers)
DROP FUNCTION IF EXISTS public.get_admin_customers();
CREATE OR REPLACE FUNCTION public.get_admin_customers()
RETURNS TABLE (
  id                  uuid,
  name                text,
  phone               text,
  avatar_url          text,
  created_at          timestamptz,
  total_bookings      bigint,
  completed_bookings  bigint,
  active_bookings     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin_2fa();

  RETURN QUERY
  SELECT
    p.id,
    p.full_name::text                                                                AS name,
    p.phone::text                                                                    AS phone,
    p.avatar_url::text                                                               AS avatar_url,
    p.created_at,
    COUNT(b.id)                                                                      AS total_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'completed')                               AS completed_bookings,
    COUNT(b.id) FILTER (WHERE b.status IN ('pending', 'accepted', 'in_progress'))   AS active_bookings
  FROM public.profiles p
  LEFT JOIN public.bookings b ON b.customer_id = p.id
  WHERE p.role = 'customer'
  GROUP BY p.id, p.full_name, p.phone, p.avatar_url, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_customers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_customers() TO authenticated, service_role;

-- 6h. get_admin_notifications — add 2FA guard
DROP FUNCTION IF EXISTS public.get_admin_notifications(integer);
CREATE OR REPLACE FUNCTION public.get_admin_notifications(limit_count integer DEFAULT 100)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  booking_id        uuid,
  notification_type text,
  title             text,
  body              text,
  read_at           timestamptz,
  created_at        timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin_2fa();

  RETURN QUERY
  SELECT
    n.id, n.user_id, n.booking_id,
    n.notification_type::text, n.title::text, n.body::text,
    n.read_at, n.created_at
  FROM public.notifications n
  ORDER BY n.created_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_notifications(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_notifications(integer) TO authenticated, service_role;

-- ============================================================================
-- 7. ADMIN PHONE IMMUTABILITY
-- Harden guard_profile_updates() to prevent admin phone changes via normal
-- profile update path. Admin phone can only be changed by the Super Admin
-- through an explicit privileged workflow (not yet implemented — blocked here).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 0. Permit direct database administrator / SQL Editor executions
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

  -- 3. Protect Super Admin account immutability
  IF OLD.id = public.get_super_admin_uuid() OR OLD.role = 'super_admin' THEN
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
    IF NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'Action prohibited: The super_admin role is strictly reserved for the authoritative Super Administrator.';
    END IF;
    IF NEW.role = 'sub_admin' OR OLD.role = 'sub_admin' THEN
      IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the Super Administrator can assign or modify Sub Administrator roles.';
      END IF;
    ELSIF NEW.role = 'worker' THEN
      IF NOT (public.is_admin() OR current_setting('jugnu.worker_registration_in_progress', true) = 'true') THEN
        RAISE EXCEPTION 'Unauthorized: Role cannot be modified directly.';
      END IF;
    ELSIF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change user roles.';
    END IF;
  END IF;

  -- 5. Admin phone immutability: admin phone can only be changed by Super Admin
  --    or by the admin themselves IF they have an active 2FA session.
  --    Regular profile update path (customers updating their own phone) is unaffected.
  IF (OLD.role IN ('super_admin', 'sub_admin')) AND
     (NEW.phone IS DISTINCT FROM OLD.phone) THEN
    -- Super Admin can change their own phone (they are the authority)
    IF OLD.id = public.get_super_admin_uuid() AND auth.uid() = OLD.id THEN
      -- Allowed: Super Admin updating their own phone
      NULL;
    -- Super Admin can change a Sub Admin's phone (provisioning)
    ELSIF public.is_super_admin() THEN
      -- Allowed: Super Admin updating a Sub Admin's phone
      NULL;
    ELSE
      RAISE EXCEPTION 'Action prohibited: Administrator phone numbers cannot be changed through the standard profile update path. Contact the Super Administrator.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 0026; CREATE OR REPLACE on the function is sufficient.

-- ============================================================================
-- 8. CLEANUP: delete expired 2FA sessions (safe to run periodically)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_admin_2fa_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_2fa_sessions WHERE expires_at < now();
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_admin_2fa_sessions() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_admin_2fa_sessions() TO service_role;

COMMIT;
