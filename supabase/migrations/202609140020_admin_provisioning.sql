-- Migration: 202609140020_admin_provisioning.sql
-- Description: RPC for existing platform administrators to provision and manage sub-administrator accounts.
-- Enforces that only verified administrators can call these functions.

-- Ensure pgcrypto extension is enabled for password hashing
create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 1. FUNCTION: Provision New Administrator (Admin-Only)
-- ============================================================================
create or replace function public.admin_create_sub_admin(
  admin_email text,
  admin_password text,
  admin_full_name text,
  admin_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller_id uuid;
  v_clean_email text;
  v_clean_phone text;
  v_user_id uuid;
  v_existing_role public.user_role;
begin
  v_caller_id := auth.uid();

  -- 1. Strict Security Guard: Only platform administrators can create admin accounts
  if not public.is_admin() then
    raise exception 'Unauthorized: Only platform administrators can provision administrator accounts.';
  end if;

  -- 2. Validate Inputs
  v_clean_email := lower(trim(admin_email));
  if v_clean_email is null or v_clean_email = '' or v_clean_email not like '%_@__%.__%' then
    raise exception 'Please provide a valid email address for the new administrator.';
  end if;

  if admin_password is null or length(admin_password) < 6 then
    raise exception 'Password must be at least 6 characters long.';
  end if;

  if admin_full_name is null or trim(admin_full_name) = '' then
    raise exception 'Please provide the full name of the new administrator.';
  end if;

  -- Format phone (+91XXXXXXXXXX)
  v_clean_phone := regexp_replace(coalesce(admin_phone, ''), '\D', '', 'g');
  if length(v_clean_phone) >= 10 then
    v_clean_phone := '+91' || right(v_clean_phone, 10);
  else
    raise exception 'Please provide a valid 10-digit mobile number for mandatory 2FA OTP.';
  end if;

  -- 3. Check if user already exists in public.profiles
  select id, role into v_user_id, v_existing_role
  from public.profiles
  where lower(email) = v_clean_email;

  if v_existing_role = 'admin' then
    raise exception 'An administrator account with email % already exists.', v_clean_email;
  end if;

  -- 4. Check if user exists in auth.users
  if v_user_id is null then
    select id into v_user_id
    from auth.users
    where lower(email) = v_clean_email;
  end if;

  if v_user_id is not null then
    -- Account already exists in auth: update credentials and elevate role to admin
    update auth.users
    set encrypted_password = crypt(admin_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', trim(admin_full_name)),
        updated_at = now()
    where id = v_user_id;

    update public.profiles
    set role = 'admin',
        full_name = trim(admin_full_name),
        phone = v_clean_phone,
        email = v_clean_email,
        updated_at = now()
    where id = v_user_id;
  else
    -- Create completely new auth user
    v_user_id := gen_random_uuid();

    insert into auth.users (
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
    ) values (
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

    insert into public.profiles (
      id,
      full_name,
      email,
      phone,
      role,
      created_at,
      updated_at
    ) values (
      v_user_id,
      trim(admin_full_name),
      v_clean_email,
      v_clean_phone,
      'admin',
      now(),
      now()
    )
    on conflict (id) do update
    set role = 'admin',
        full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        updated_at = now();
  end if;

  -- 5. Audit Logging in admin_actions
  insert into public.admin_actions (
    admin_id,
    action,
    target_type,
    target_id,
    details
  ) values (
    v_caller_id,
    'provision_administrator',
    'profile',
    v_user_id,
    jsonb_build_object(
      'new_admin_email', v_clean_email,
      'new_admin_name', trim(admin_full_name),
      'new_admin_phone', v_clean_phone,
      'created_by_admin_id', v_caller_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_clean_email,
    'message', 'Administrator account successfully provisioned.'
  );
end;
$$;

-- Grant execute permissions
grant execute on function public.admin_create_sub_admin(text, text, text, text) to authenticated;

-- ============================================================================
-- 2. FUNCTION: Get Administrator Team List (Admin-Only)
-- ============================================================================
create or replace function public.get_admin_team()
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only platform administrators can view the administrator team list.';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.created_at
  from public.profiles p
  where p.role = 'admin'
  order by p.created_at asc;
end;
$$;

-- Grant execute permissions
grant execute on function public.get_admin_team() to authenticated;
