-- Migration 202609140018: Security & RLS Hardening
-- Phase 11: Row-Level Security & Database Trigger Defenses

-- 1. HARDEN WORKER PROFILES: Prevent Self-Approval & Rating Tampering
-- Non-admin callers (workers/customers) must NEVER be able to modify:
--   - approval_status
--   - approved_at
--   - rejection_reason
--   - rating
--   - review_count
create or replace function public.guard_worker_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If caller is not an administrator, preserve protected fields
  if not public.is_admin() then
    -- If user attempted to tamper with approval status
    if new.approval_status is distinct from old.approval_status then
      raise exception 'Only platform administrators can modify worker approval status';
    end if;

    -- If user attempted to alter rating or review count
    if new.rating is distinct from old.rating or new.review_count is distinct from old.review_count then
      new.rating := old.rating;
      new.review_count := old.review_count;
    end if;

    -- Preserve admin review timestamps and reasons
    new.approved_at := old.approved_at;
    new.rejection_reason := old.rejection_reason;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_worker_profile_updates on public.worker_profiles;
create trigger trg_guard_worker_profile_updates
before update on public.worker_profiles
for each row
execute function public.guard_worker_profile_updates();


-- 2. HARDEN BOOKINGS: Block Active Bookings for Unapproved or Inactive Workers
-- Direct table inserts or updates must fail if the target worker is not approved
create or replace function public.enforce_approved_worker_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_status public.worker_approval_status;
  v_worker_available boolean;
begin
  select approval_status, is_available
  into v_worker_status, v_worker_available
  from public.worker_profiles
  where id = new.worker_id;

  if v_worker_status is null then
    raise exception 'The designated worker does not exist';
  end if;

  if v_worker_status <> 'approved' then
    raise exception 'Bookings cannot be assigned to unapproved or rejected workers (current status: %)', v_worker_status;
  end if;

  -- On new bookings, verify availability unless created by an admin
  if tg_op = 'INSERT' and not v_worker_available and not public.is_admin() then
    raise exception 'This worker is currently not available for bookings';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_approved_worker_booking on public.bookings;
create trigger trg_enforce_approved_worker_booking
before insert or update of worker_id on public.bookings
for each row
execute function public.enforce_approved_worker_booking();


-- 3. HARDEN BOOKINGS RLS: Isolation Guarantee
-- Ensure customers can only SELECT their own bookings
-- Ensure workers can only SELECT bookings assigned to them
-- Ensure admins can SELECT all bookings
drop policy if exists "Customers and assigned workers can read bookings" on public.bookings;
create policy "Customers and assigned workers can read bookings"
on public.bookings for select
using (
  customer_id = auth.uid()
  or worker_id = auth.uid()
  or public.is_admin()
);

-- Ensure customers cannot modify worker_id or status arbitrarily
drop policy if exists "Workers can update assigned bookings" on public.bookings;
create policy "Workers can update assigned bookings"
on public.bookings for update
using (
  worker_id = auth.uid()
  or public.is_admin()
)
with check (
  (worker_id = auth.uid() or public.is_admin())
);

-- Customers can only cancel their own pending/accepted bookings
drop policy if exists "Customers can cancel their pending or accepted bookings" on public.bookings;
create policy "Customers can cancel their pending or accepted bookings"
on public.bookings for update
using (
  customer_id = auth.uid()
  and status in ('pending', 'accepted')
)
with check (
  customer_id = auth.uid()
  and status = 'cancelled'
);


-- 4. HARDEN STORAGE: Guarantee Private Status of ID Documents
-- The worker-documents bucket must remain private (public = false)
update storage.buckets
set public = false
where id = 'worker-documents';

-- Strictly enforce that only verified Admins and Document Owners can view or delete ID documents
drop policy if exists "Admins and owners can view ID documents" on storage.objects;
create policy "Admins and owners can view ID documents"
on storage.objects for select
using (
  bucket_id = 'worker-documents'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

drop policy if exists "Admins and owners can delete ID documents" on storage.objects;
create policy "Admins and owners can delete ID documents"
on storage.objects for delete
using (
  bucket_id = 'worker-documents'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

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
