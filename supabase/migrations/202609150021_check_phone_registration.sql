-- Migration: 202609150021_check_phone_registration.sql
-- Description: Secure public verification of user registration status for login & signup flows.
-- Allows checking whether a mobile number is registered without leaking sensitive profile data.

create or replace function public.check_phone_registration(lookup_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_digits text;
  formatted_phone text;
  v_profile record;
  v_has_worker_profile boolean := false;
  v_has_auth_user boolean := false;
begin
  -- Extract trailing 10 digits
  clean_digits := right(regexp_replace(coalesce(lookup_phone, ''), '\D', '', 'g'), 10);

  if length(clean_digits) < 10 then
    return jsonb_build_object(
      'registered', false,
      'error', 'Please enter a valid 10-digit mobile number'
    );
  end if;

  formatted_phone := '+91' || clean_digits;

  -- 1. Check in public.profiles table
  select id, full_name, role, phone, email
  into v_profile
  from public.profiles
  where phone = formatted_phone or phone = clean_digits
  limit 1;

  if v_profile.id is not null then
    -- Check if registered worker profile exists
    select exists (
      select 1 from public.worker_profiles where id = v_profile.id
    ) into v_has_worker_profile;

    return jsonb_build_object(
      'registered', true,
      'role', coalesce(v_profile.role, 'customer'),
      'is_worker', (v_profile.role = 'worker' or v_has_worker_profile),
      'full_name', v_profile.full_name,
      'email', v_profile.email
    );
  end if;

  -- 2. Check in auth.users fallback (in case profile creation was delayed)
  select exists (
    select 1
    from auth.users
    where phone = formatted_phone
       or lower(email) = clean_digits || '@phone.kaamgar.local'
  ) into v_has_auth_user;

  if v_has_auth_user then
    return jsonb_build_object(
      'registered', true,
      'role', 'customer',
      'is_worker', false,
      'full_name', 'Registered User'
    );
  end if;

  return jsonb_build_object(
    'registered', false,
    'role', null,
    'is_worker', false
  );
end;
$$;

-- Grant execute permissions to anonymous, authenticated, and service_role callers
grant execute on function public.check_phone_registration(text) to anon, authenticated, service_role;
