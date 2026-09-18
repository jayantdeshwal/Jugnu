-- Migration: 202609180027_phase2b_security_hardening.sql
-- Description: Phase 2B Security Hardening
-- 1. JUGNU-SEC-06: check_phone_registration PII & Role Exposure Elimination
-- 2. JUGNU-SEC-08: Booking State Machine & Field Protection Triggers
-- 3. JUGNU-SEC-09: Self-Booking Prevention Invariant
-- 4. Storage KYC Upload Authorization Hardening

-- ============================================================================
-- 1. JUGNU-SEC-06: check_phone_registration PII & Role Exposure Elimination
-- ============================================================================
-- Minimized to return ONLY boolean registration status.
-- Anonymous callers receive zero PII (no full_name, email, role, is_worker, or internal IDs).

create or replace function public.check_phone_registration(lookup_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_digits text;
  formatted_phone text;
  v_exists boolean := false;
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
  select exists (
    select 1
    from public.profiles
    where phone = formatted_phone or phone = clean_digits
  ) into v_exists;

  if v_exists then
    return jsonb_build_object(
      'registered', true
    );
  end if;

  -- 2. Fallback check in auth.users
  select exists (
    select 1
    from auth.users
    where phone = formatted_phone
       or lower(email) = clean_digits || '@phone.kaamgar.local'
  ) into v_exists;

  return jsonb_build_object(
    'registered', v_exists
  );
end;
$$;

-- Explicit execute grants
revoke execute on function public.check_phone_registration(text) from public;
grant execute on function public.check_phone_registration(text) to anon, authenticated, service_role;


-- ============================================================================
-- 2. JUGNU-SEC-08 & JUGNU-SEC-09: BOOKING STATE MACHINE & FIELD INTEGRITY
-- ============================================================================

-- Function: Guard booking inserts
create or replace function public.guard_booking_inserts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass for automated maintenance or migration executions in superuser session
  if session_user in ('postgres', 'supabase_admin') and auth.uid() is null then
    return new;
  end if;

  -- JUGNU-SEC-09: Enforce Self-Booking Prevention
  if new.customer_id = new.worker_id then
    raise exception 'Action prohibited: Users cannot book their own services (self-booking).';
  end if;

  -- For non-administrators, enforce customer identity and initial status
  if not public.is_admin() then
    if auth.uid() is null then
      raise exception 'Unauthorized: Authentication required to create bookings.';
    end if;

    if new.customer_id <> auth.uid() then
      raise exception 'Action prohibited: You cannot create bookings on behalf of another user.';
    end if;

    -- Enforce initial status MUST be pending
    if new.status is distinct from 'pending' then
      raise exception 'Action prohibited: New bookings must be created with status pending.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_booking_inserts on public.bookings;
create trigger trg_guard_booking_inserts
before insert on public.bookings
for each row
execute function public.guard_booking_inserts();


-- Function: Guard booking updates (State machine & field immutability)
create or replace function public.guard_booking_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_customer boolean := false;
  v_is_worker boolean := false;
  v_is_admin boolean := false;
begin
  -- Bypass for superuser / migration runner
  if session_user in ('postgres', 'supabase_admin') and auth.uid() is null then
    return new;
  end if;

  v_is_admin := public.is_admin();

  -- Admins retain legitimate administrative override capabilities
  if v_is_admin then
    new.updated_at := timezone('utc', now());
    return new;
  end if;

  -- Enforce caller authentication
  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required to update bookings.';
  end if;

  v_is_customer := (auth.uid() = old.customer_id);
  v_is_worker := (auth.uid() = old.worker_id);

  if not v_is_customer and not v_is_worker then
    raise exception 'Unauthorized: You do not have permission to update this booking.';
  end if;

  -- 1. Strict Field Immutability (Neither customer nor worker may modify these)
  if new.id <> old.id then
    raise exception 'Action prohibited: Booking ID is immutable.';
  end if;

  if new.customer_id <> old.customer_id then
    raise exception 'Action prohibited: Booking customer cannot be changed.';
  end if;

  if new.worker_id <> old.worker_id then
    raise exception 'Action prohibited: Assigned worker cannot be changed.';
  end if;

  if new.created_at <> old.created_at then
    raise exception 'Action prohibited: Booking creation timestamp is immutable.';
  end if;

  -- 2. Terminal State Locking: Terminal bookings cannot be modified or reopened
  if old.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'Action prohibited: Completed, cancelled, or rejected bookings cannot be modified or reopened.';
  end if;

  -- 3. Customer Lifecycle & Field Restrictions
  if v_is_customer then
    -- Customers cannot alter assigned category, service area, or worker
    if new.category_id <> old.category_id or new.service_area_id is distinct from old.service_area_id then
      raise exception 'Action prohibited: Booking service category and area cannot be altered after booking.';
    end if;

    -- Customer State Machine: can only transition from pending/accepted to cancelled
    if new.status is distinct from old.status then
      if old.status in ('pending', 'accepted') and new.status = 'cancelled' then
        -- Allowed cancellation
        null;
      else
        raise exception 'Invalid booking status transition for customer: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  -- 4. Worker Lifecycle & Field Restrictions
  if v_is_worker then
    -- Worker cannot alter customer address, category, or scheduled time
    if new.address <> old.address or new.category_id <> old.category_id or new.scheduled_at is distinct from old.scheduled_at then
      raise exception 'Action prohibited: Worker cannot alter customer address, category, or scheduled appointment time.';
    end if;

    -- Worker State Machine Transitions:
    -- pending -> accepted
    -- pending -> rejected
    -- accepted -> in_progress
    -- in_progress -> completed
    if new.status is distinct from old.status then
      if old.status = 'pending' and new.status in ('accepted', 'rejected') then
        -- Allowed
        null;
      elsif old.status = 'accepted' and new.status = 'in_progress' then
        -- Allowed
        null;
      elsif old.status = 'in_progress' and new.status = 'completed' then
        -- Allowed
        null;
      else
        raise exception 'Invalid booking status transition for worker: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  -- Auto-update timestamp
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_guard_booking_updates on public.bookings;
create trigger trg_guard_booking_updates
before update on public.bookings
for each row
execute function public.guard_booking_updates();


-- ============================================================================
-- 3. KYC STORAGE UPLOAD AUTHORIZATION HARDENING
-- ============================================================================

-- Ensure worker-documents bucket is private
update storage.buckets
set public = false
where id = 'worker-documents';

-- Hardened upload policy: Authenticated users can ONLY upload into their own folder (folder name matches auth.uid())
drop policy if exists "Workers can upload ID documents" on storage.objects;
create policy "Workers can upload ID documents"
on storage.objects for insert
with check (
  bucket_id = 'worker-documents'
  and auth.role() = 'authenticated'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

-- Ensure update policy is also restricted to document owners or administrators
drop policy if exists "Admins and owners can update ID documents" on storage.objects;
create policy "Admins and owners can update ID documents"
on storage.objects for update
using (
  bucket_id = 'worker-documents'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = split_part(name, '/', 1)
  )
);
