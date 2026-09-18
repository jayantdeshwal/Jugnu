-- Migration: 202609180024_production_database_cleanup.sql
-- Description: Production Database Reset & Test Data Purge while STRICTLY PRESERVING Admin Account
-- Target Admin: jayant.deshwal.56@gmail.com (and all accounts with role = 'admin')

BEGIN;

-- ============================================================================
-- STEP 1: ISOLATE & PROTECT ADMINISTRATOR ACCOUNT
-- ============================================================================
CREATE TEMP TABLE admin_safe_ids ON COMMIT DROP AS
SELECT id FROM public.profiles WHERE role = 'admin' OR lower(email) = 'jayant.deshwal.56@gmail.com'
UNION
SELECT id FROM auth.users WHERE lower(email) = 'jayant.deshwal.56@gmail.com';

-- Ensure we found the admin or raise exception if no admin exists to avoid deleting everything
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_safe_ids) THEN
    RAISE EXCEPTION 'CRITICAL: No administrator account identified. Aborting cleanup to protect database.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: PURGE TEST TRANSACTIONS, RATINGS & NOTIFICATIONS
-- ============================================================================
DELETE FROM public.complaints;
DELETE FROM public.reviews;
DELETE FROM public.bookings;
DELETE FROM public.notifications WHERE user_id NOT IN (SELECT id FROM admin_safe_ids);
DELETE FROM public.admin_actions;

-- ============================================================================
-- STEP 3: PURGE TEST WORKERS & SERVICE AREAS
-- ============================================================================
DELETE FROM public.worker_service_areas;
DELETE FROM public.worker_categories;
DELETE FROM public.worker_profiles;

-- ============================================================================
-- STEP 4: PURGE TEST CUSTOMER PROFILES & TEST AUTH ACCOUNTS
-- (Admin is strictly excluded and preserved)
-- ============================================================================
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM admin_safe_ids);
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM admin_safe_ids);

-- ============================================================================
-- STEP 5: REMOVE OBSOLETE LEGACY CATEGORIES
-- ============================================================================
DELETE FROM public.categories WHERE id IN ('ac', 'cleaning', 'men_salon', 'women_spa');

-- ============================================================================
-- STEP 6: VERIFY & GUARANTEE ADMIN CONFIGURATION IN PROFILES
-- ============================================================================
UPDATE public.profiles
SET role = 'admin',
    updated_at = timezone('utc', now())
WHERE id IN (SELECT id FROM admin_safe_ids);

COMMIT;

-- ============================================================================
-- VERIFICATION REPORT (Inspect output in Supabase SQL editor)
-- ============================================================================
SELECT 
  (SELECT count(*) FROM auth.users) AS preserved_auth_users,
  (SELECT count(*) FROM public.profiles WHERE role = 'admin') AS admin_profiles,
  (SELECT count(*) FROM public.worker_profiles) AS remaining_test_workers,
  (SELECT count(*) FROM public.bookings) AS remaining_test_bookings,
  (SELECT count(*) FROM public.categories) AS remaining_categories;
