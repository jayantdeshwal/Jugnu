-- Migration: 202609180028_multi_service_worker_registration.sql
-- Description: Implement database-level enforcement for multi-service worker registration (max 2 services from the exact same parent category).

-- 1. Add parent_category_id to public.categories if not exists
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_category_id text REFERENCES public.categories(id) ON DELETE RESTRICT;

-- 2. Populate parent_category_id for all canonical services according to canonical taxonomy
-- Category 1: Home Repair & Work (home_repair)
UPDATE public.categories SET parent_category_id = 'home_repair'
WHERE id IN ('electrician', 'plumber', 'carpenter', 'painter', 'daily_wage_worker', 'raj_mistri');

-- Category 2: Home Appliance Repair (appliance_repair)
UPDATE public.categories SET parent_category_id = 'appliance_repair'
WHERE id IN ('ac_repair', 'refrigerator_repair', 'washing_machine_repair', 'ro_repair', 'geyser_repair');

-- Category 3: Beauty & Personal Care (beauty_personal_care)
UPDATE public.categories SET parent_category_id = 'beauty_personal_care'
WHERE id IN ('parlour_service', 'nail_extension', 'mehendi_artist');

-- Category 4: Home Help & Cleaning (home_help_cleaning)
UPDATE public.categories SET parent_category_id = 'home_help_cleaning'
WHERE id IN ('part_time_maid', 'dry_clean_press');

-- Category 5: Vehicle & Emergency Services (vehicle_emergency)
UPDATE public.categories SET parent_category_id = 'vehicle_emergency'
WHERE id IN ('part_time_driver', 'car_mechanic', 'ambulance');

-- Legacy mappings for backward compatibility
UPDATE public.categories SET parent_category_id = 'appliance_repair' WHERE id = 'ac';
UPDATE public.categories SET parent_category_id = 'home_help_cleaning' WHERE id = 'cleaning';
UPDATE public.categories SET parent_category_id = 'beauty_personal_care' WHERE id IN ('men_salon', 'women_spa');

-- Ensure top-level parent categories have NULL parent_category_id
UPDATE public.categories SET parent_category_id = NULL
WHERE id IN ('home_repair', 'appliance_repair', 'beauty_personal_care', 'home_help_cleaning', 'vehicle_emergency');

-- 3. Database Trigger to enforce invariant directly on public.worker_categories:
-- Invariants:
-- a) A worker cannot be registered for more than 2 services
-- b) All services registered for a worker must belong to the exact same parent category
-- c) Cannot register a top-level trade group as a service
CREATE OR REPLACE FUNCTION public.check_worker_categories_invariants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
  v_count integer;
  v_parent_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_worker_id := NEW.worker_id;

  -- Count total services and distinct parent categories for this worker
  SELECT count(*)::integer, count(DISTINCT coalesce(c.parent_category_id, c.id))::integer
    INTO v_count, v_parent_count
  FROM public.worker_categories wc
  JOIN public.categories c ON c.id = wc.category_id
  WHERE wc.worker_id = v_worker_id;

  -- Invariant 1: Maximum 2 services
  IF v_count > 2 THEN
    RAISE EXCEPTION 'A worker cannot be registered for more than 2 services (worker % has %)', v_worker_id, v_count;
  END IF;

  -- Invariant 2: Exactly 1 parent category across all services
  IF v_parent_count > 1 THEN
    RAISE EXCEPTION 'Worker services must belong to the exact same parent category';
  END IF;

  -- Invariant 3: Must be leaf services, not parent category groups
  IF EXISTS (
    SELECT 1 FROM public.worker_categories wc
    JOIN public.categories c ON c.id = wc.category_id
    WHERE wc.worker_id = v_worker_id AND c.parent_category_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Worker cannot register for a top-level parent category group as a service';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_categories_invariants ON public.worker_categories;
CREATE TRIGGER trg_worker_categories_invariants
AFTER INSERT OR UPDATE ON public.worker_categories
FOR EACH ROW
EXECUTE FUNCTION public.check_worker_categories_invariants();

-- 4. Update public.register_worker RPC to accept multiple services while preserving backward compatibility
CREATE OR REPLACE FUNCTION public.register_worker(
  worker_name text,
  worker_phone text,
  worker_bio text,
  worker_experience integer,
  worker_category_id text DEFAULT NULL,
  worker_area_pincodes text[] DEFAULT ARRAY[]::text[],
  worker_avatar_url text DEFAULT NULL,
  worker_id_proof_url text DEFAULT NULL,
  worker_category_ids text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_categories text[];
  v_count integer;
  v_matched_count integer;
  v_parent_count integer;
  v_parent_id text;
  requested_area_count integer;
  matched_area_count integer;
  area_ids uuid[];
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

  -- 1. Consolidate requested services from worker_category_ids or legacy worker_category_id
  IF worker_category_ids IS NOT NULL AND array_length(worker_category_ids, 1) > 0 THEN
    SELECT array_agg(DISTINCT trim(c))
      INTO v_final_categories
    FROM unnest(worker_category_ids) AS c
    WHERE trim(c) <> '';
  ELSIF worker_category_id IS NOT NULL AND trim(worker_category_id) <> '' THEN
    v_final_categories := ARRAY[trim(worker_category_id)];
  ELSE
    RAISE EXCEPTION 'Please select at least one work service';
  END IF;

  v_count := coalesce(array_length(v_final_categories, 1), 0);

  -- 2. Strict Service Count Invariant: between 1 and 2 services
  IF v_count < 1 OR v_count > 2 THEN
    RAISE EXCEPTION 'A worker may select at most 2 services (requested: %)', v_count;
  END IF;

  -- 3. Verify all selected services exist in public.categories AND are leaf services
  SELECT count(*)::integer, count(DISTINCT parent_category_id)::integer, min(parent_category_id)
    INTO v_matched_count, v_parent_count, v_parent_id
  FROM public.categories
  WHERE id = ANY(v_final_categories);

  IF v_matched_count <> v_count THEN
    RAISE EXCEPTION 'One or more selected services are invalid';
  END IF;

  -- Prevent choosing a top-level parent category itself as a service
  IF EXISTS (
    SELECT 1 FROM public.categories 
    WHERE id = ANY(v_final_categories) AND parent_category_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot select a top-level trade group as a service. Please select specific services.';
  END IF;

  -- 4. Strict Single Parent Category Invariant: All services must share the exact same parent_category_id
  IF v_parent_count <> 1 OR v_parent_id IS NULL THEN
    RAISE EXCEPTION 'All selected services must belong to the exact same parent category';
  END IF;

  -- Validate service areas
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

  -- Update categories with ALL selected services (1 or 2)
  DELETE FROM public.worker_categories WHERE worker_id = auth.uid();
  INSERT INTO public.worker_categories (worker_id, category_id)
  SELECT auth.uid(), unnest(v_final_categories);

  -- Update service areas
  DELETE FROM public.worker_service_areas WHERE worker_id = auth.uid();
  INSERT INTO public.worker_service_areas (worker_id, service_area_id)
  SELECT auth.uid(), unnest(area_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_worker(text, text, text, integer, text, text[], text, text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_worker(text, text, text, integer, text, text[], text, text, text[]) TO authenticated, service_role;
