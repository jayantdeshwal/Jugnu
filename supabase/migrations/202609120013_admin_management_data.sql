-- Phase 8: Admin Management & Live Directories
-- 1. Ensure Admins and profile owners can read all worker categories and service areas
-- 2. get_admin_workers RPC: Aggregate workers with profile, categories, service areas, and real booking counts
-- 3. get_admin_customers RPC: Aggregate customers with profile info and real booking counts

-- 1. RLS Policies on worker_categories
drop policy if exists "Admins and owners can read worker categories" on public.worker_categories;
create policy "Admins and owners can read worker categories"
on public.worker_categories for select
using (worker_id = auth.uid() or public.is_admin());

-- RLS Policies on worker_service_areas
drop policy if exists "Admins and owners can read worker service areas" on public.worker_service_areas;
create policy "Admins and owners can read worker service areas"
on public.worker_service_areas for select
using (worker_id = auth.uid() or public.is_admin());

-- 2. RPC: Get all workers for Admin Dashboard
create or replace function public.get_admin_workers()
returns table (
  id uuid,
  name text,
  phone text,
  avatar_url text,
  bio text,
  experience_years integer,
  approval_status public.worker_approval_status,
  is_available boolean,
  rating numeric,
  review_count integer,
  rejection_reason text,
  created_at timestamptz,
  categories text[],
  areas text[],
  completed_jobs bigint,
  total_bookings bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: Administrator privileges required';
  end if;

  return query
  select
    wp.id,
    p.full_name as name,
    p.phone,
    p.avatar_url,
    wp.bio,
    wp.experience_years,
    wp.approval_status,
    wp.is_available,
    wp.rating,
    wp.review_count,
    wp.rejection_reason,
    wp.created_at,
    coalesce(array_remove(array_agg(distinct wc.category_id), null), '{}'::text[]) as categories,
    coalesce(array_remove(array_agg(distinct sa.pincode), null), '{}'::text[]) as areas,
    count(distinct b.id) filter (where b.status = 'completed') as completed_jobs,
    count(distinct b.id) as total_bookings
  from public.worker_profiles wp
  join public.profiles p on p.id = wp.id
  left join public.worker_categories wc on wc.worker_id = wp.id
  left join public.worker_service_areas wsa on wsa.worker_id = wp.id
  left join public.service_areas sa on sa.id = wsa.service_area_id
  left join public.bookings b on b.worker_id = wp.id
  group by
    wp.id,
    p.full_name,
    p.phone,
    p.avatar_url,
    wp.bio,
    wp.experience_years,
    wp.approval_status,
    wp.is_available,
    wp.rating,
    wp.review_count,
    wp.rejection_reason,
    wp.created_at
  order by wp.created_at desc;
end;
$$;

revoke execute on function public.get_admin_workers() from public;
grant execute on function public.get_admin_workers() to authenticated;

-- 3. RPC: Get all customers for Admin Dashboard
create or replace function public.get_admin_customers()
returns table (
  id uuid,
  name text,
  phone text,
  avatar_url text,
  created_at timestamptz,
  total_bookings bigint,
  completed_bookings bigint,
  active_bookings bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: Administrator privileges required';
  end if;

  return query
  select
    p.id,
    p.full_name as name,
    p.phone,
    p.avatar_url,
    p.created_at,
    count(distinct b.id) as total_bookings,
    count(distinct b.id) filter (where b.status = 'completed') as completed_bookings,
    count(distinct b.id) filter (where b.status in ('pending', 'accepted', 'in_progress')) as active_bookings
  from public.profiles p
  left join public.bookings b on b.customer_id = p.id
  where p.role = 'customer'
  group by
    p.id,
    p.full_name,
    p.phone,
    p.avatar_url,
    p.created_at
  order by p.created_at desc;
end;
$$;

revoke execute on function public.get_admin_customers() from public;
grant execute on function public.get_admin_customers() to authenticated;
