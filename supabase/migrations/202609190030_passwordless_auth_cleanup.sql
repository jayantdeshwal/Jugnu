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
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone = formatted_phone
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('registered', true);
  END IF;

  -- 2. Fallback check in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE phone = formatted_phone
  ) INTO v_exists;

  RETURN jsonb_build_object('registered', v_exists);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_phone_registration(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_phone_registration(text) TO anon, authenticated, service_role;

COMMIT;
