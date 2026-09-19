-- Migration: 202609190030_passwordless_auth_cleanup.sql
-- Description: Passwordless authentication cleanup - enforce canonical phone uniqueness and clean check_phone_registration RPC.

BEGIN;

-- 1. Add unique partial index on public.profiles(phone) to guarantee phone uniqueness across all users
DROP INDEX IF EXISTS public.uq_profiles_phone;
CREATE UNIQUE INDEX uq_profiles_phone
ON public.profiles (phone)
WHERE phone IS NOT NULL;

-- 2. Update check_phone_registration RPC: remove legacy synthetic @phone.kaamgar.local check
CREATE OR REPLACE FUNCTION public.check_phone_registration(lookup_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  clean_digits text;
  formatted_phone text;
  v_exists boolean := false;
  v_role text := null;
  v_name text := null;
  v_email text := null;
BEGIN
  -- Extract trailing 10 digits
  clean_digits := right(regexp_replace(coalesce(lookup_phone, ''), '\D', '', 'g'), 10);

  IF length(clean_digits) < 10 THEN
    RETURN jsonb_build_object(
      'registered', false,
      'error', 'Please enter a valid 10-digit mobile number'
    );
  END IF;

  formatted_phone := '+91' || clean_digits;

  -- 1. Check in public.profiles table
  SELECT p.role::text, p.full_name, p.email
  INTO v_role, v_name, v_email
  FROM public.profiles p
  WHERE p.phone = formatted_phone
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN jsonb_build_object(
      'registered', true,
      'role', v_role,
      'fullName', coalesce(v_name, ''),
      'email', coalesce(v_email, ''),
      'isWorker', v_role = 'worker'
    );
  END IF;

  -- 2. Fallback check in auth.users
  SELECT u.email
  INTO v_email
  FROM auth.users u
  WHERE u.phone = formatted_phone
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN jsonb_build_object(
      'registered', true,
      'role', 'customer',
      'fullName', '',
      'email', v_email,
      'isWorker', false
    );
  END IF;

  RETURN jsonb_build_object(
    'registered', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_phone_registration(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_phone_registration(text) TO anon, authenticated, service_role;

COMMIT;
