-- Migration: 202609200032_admin_phone_only_auth.sql
-- Description: Admin authentication redesign — phone + MSG91 OTP only.
--   - admin_create_sub_admin: remove admin_password parameter (admins authenticate via phone OTP)
--   - New overload without password; old overload dropped to avoid ambiguity
--   - All other admin_2fa_sessions infrastructure, require_admin_2fa(), privileged RPCs unchanged

BEGIN;

-- ============================================================================
-- 1. DROP OLD admin_create_sub_admin (had admin_password parameter)
--    Replace with phone-only provisioning (no password needed)
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_create_sub_admin(text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_sub_admin(
  admin_email     text,
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
  v_random_pw      text;
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

  IF admin_full_name IS NULL OR trim(admin_full_name) = '' THEN
    RAISE EXCEPTION 'Please provide the full name of the new administrator.';
  END IF;

  v_clean_phone := regexp_replace(coalesce(admin_phone, ''), '\D', '', 'g');
  IF length(v_clean_phone) >= 10 THEN
    v_clean_phone := '+91' || right(v_clean_phone, 10);
  ELSE
    RAISE EXCEPTION 'Please provide a valid 10-digit mobile number for OTP authentication.';
  END IF;

  -- Check if phone already belongs to an admin
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone = v_clean_phone
      AND role IN ('super_admin', 'sub_admin')
      AND id <> v_caller_id
  ) THEN
    RAISE EXCEPTION 'An administrator account with this phone number already exists.';
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
    -- Existing account: elevate to sub_admin and set phone
    UPDATE public.profiles
    SET role = 'sub_admin', full_name = trim(admin_full_name),
        phone = v_clean_phone, email = v_clean_email,
        updated_at = timezone('utc', now())
    WHERE id = v_user_id;
  ELSE
    -- New account: create auth user with a random internal password (never used — auth is phone OTP only)
    v_user_id    := gen_random_uuid();
    v_random_pw  := encode(gen_random_bytes(32), 'hex');

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_clean_email, crypt(v_random_pw, gen_salt('bf')), now(),
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
    jsonb_build_object(
      'new_admin_email', v_clean_email,
      'new_admin_name',  trim(admin_full_name),
      'new_admin_phone', v_clean_phone,
      'created_by_admin_id', v_caller_id,
      'auth_method', 'phone_otp_only'
    ));

  RETURN jsonb_build_object(
    'success', true, 'user_id', v_user_id,
    'email', v_clean_email, 'role', 'sub_admin',
    'message', 'Sub-Administrator account successfully provisioned. They must sign in via phone OTP.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_sub_admin(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_sub_admin(text, text, text) TO authenticated, service_role;

-- ============================================================================
-- 2. PROTECT get_admin_team() WITH require_admin_2fa()
--    The administrator directory exposes admin emails + phone numbers (PII) and
--    the admin hierarchy. It must require an active 30-minute 2FA authorization,
--    closing the last privileged data-access path left unprotected by migration 0031.
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
  PERFORM public.require_admin_2fa();

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

COMMIT;
