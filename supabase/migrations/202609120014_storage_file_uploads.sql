-- Phase 9: File Uploads via Supabase Storage
-- 1. Add id_proof_url column to worker_profiles
-- 2. Provision 'avatars' (public) and 'worker-documents' (private) storage buckets
-- 3. Setup RLS policies on storage.objects for avatars and private worker documents
-- 4. Update register_worker RPC to store avatar_url and id_proof_url
-- 5. Update get_admin_workers RPC to return id_proof_url

-- 1. Schema update
alter table public.worker_profiles
add column if not exists id_proof_url text;

-- 2. Storage Buckets Provisioning
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('worker-documents', 'worker-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. RLS Policies on storage.objects

-- Avatars Policies (Public Read, Owner/Authenticated Write)
drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
);

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

-- Worker Documents Policies (Strictly Private: Admins and Document Owners Only)
drop policy if exists "Workers can upload ID documents" on storage.objects;
create policy "Workers can upload ID documents"
on storage.objects for insert
with check (
  bucket_id = 'worker-documents'
  and auth.role() = 'authenticated'
);

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

-- 4. Update register_worker RPC to store avatar and ID proof URLs
drop function if exists public.register_worker(text, text, text, integer, text, text[]);
drop function if exists public.register_worker(text, text, text, integer, text, text[], text, text);

create or replace function public.register_worker(
  worker_name text,
  worker_phone text,
  worker_bio text,
  worker_experience integer,
  worker_category_id text,
  worker_area_pincodes text[],
  worker_avatar_url text default null,
  worker_id_proof_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  area_ids uuid[];
  requested_area_count integer;
  matched_area_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to register as a worker';
  end if;

  if nullif(trim(worker_name), '') is null then
    raise exception 'Worker name is required';
  end if;

  if worker_experience < 0 or worker_experience > 50 then
    raise exception 'Experience must be between 0 and 50 years';
  end if;

  if not exists (select 1 from public.categories where id = worker_category_id) then
    raise exception 'Selected category is invalid';
  end if;

  requested_area_count := coalesce(array_length(worker_area_pincodes, 1), 0);
  select array_agg(id order by pincode), count(*)::integer
    into area_ids, matched_area_count
  from public.service_areas
  where pincode = any(worker_area_pincodes);

  if requested_area_count = 0 or matched_area_count <> requested_area_count then
    raise exception 'One or more service areas are invalid';
  end if;

  -- Update profiles with name, phone, role, and optional avatar_url
  update public.profiles
  set
    full_name = trim(worker_name),
    phone = nullif(trim(worker_phone), ''),
    role = 'worker',
    avatar_url = coalesce(nullif(trim(worker_avatar_url), ''), avatar_url),
    updated_at = timezone('utc', now())
  where id = auth.uid();

  -- Upsert worker_profiles with bio, experience, and optional id_proof_url
  insert into public.worker_profiles (
    id,
    bio,
    experience_years,
    approval_status,
    rejection_reason,
    is_available,
    id_proof_url,
    updated_at
  ) values (
    auth.uid(),
    coalesce(worker_bio, ''),
    worker_experience,
    'pending',
    null,
    true,
    nullif(trim(worker_id_proof_url), ''),
    timezone('utc', now())
  )
  on conflict (id) do update set
    bio = excluded.bio,
    experience_years = excluded.experience_years,
    approval_status = 'pending',
    rejection_reason = null,
    id_proof_url = coalesce(excluded.id_proof_url, public.worker_profiles.id_proof_url),
    updated_at = timezone('utc', now());

  -- Update categories
  delete from public.worker_categories where worker_id = auth.uid();
  insert into public.worker_categories (worker_id, category_id)
  values (auth.uid(), worker_category_id);

  -- Update service areas
  delete from public.worker_service_areas where worker_id = auth.uid();
  insert into public.worker_service_areas (worker_id, service_area_id)
  select auth.uid(), unnest(area_ids);
end;
$$;

revoke execute on function public.register_worker(text, text, text, integer, text, text[], text, text) from public;
grant execute on function public.register_worker(text, text, text, integer, text, text[], text, text) to authenticated;

-- 5. Update get_admin_workers RPC to return id_proof_url
drop function if exists public.get_admin_workers();

create or replace function public.get_admin_workers()
returns table (
  id uuid,
  name text,
  phone text,
  avatar_url text,
  id_proof_url text,
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
    wp.id_proof_url,
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
    wp.id_proof_url,
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
