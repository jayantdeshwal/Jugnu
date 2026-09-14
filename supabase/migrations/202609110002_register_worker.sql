-- Secure worker onboarding for the first pilot slice.
-- This stores profile/work details only. File storage is a later phase.

create or replace function public.register_worker(
  worker_name text,
  worker_phone text,
  worker_bio text,
  worker_experience integer,
  worker_category_id text,
  worker_area_pincodes text[]
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

  update public.profiles
  set full_name = trim(worker_name),
      phone = nullif(trim(worker_phone), ''),
      role = 'worker',
      updated_at = timezone('utc', now())
  where id = auth.uid();

  insert into public.worker_profiles (
    id,
    bio,
    experience_years,
    approval_status,
    rejection_reason,
    is_available,
    updated_at
  ) values (
    auth.uid(),
    coalesce(worker_bio, ''),
    worker_experience,
    'pending',
    null,
    true,
    timezone('utc', now())
  )
  on conflict (id) do update set
    bio = excluded.bio,
    experience_years = excluded.experience_years,
    approval_status = 'pending',
    rejection_reason = null,
    updated_at = timezone('utc', now());

  delete from public.worker_categories where worker_id = auth.uid();
  insert into public.worker_categories (worker_id, category_id)
  values (auth.uid(), worker_category_id);

  delete from public.worker_service_areas where worker_id = auth.uid();
  insert into public.worker_service_areas (worker_id, service_area_id)
  select auth.uid(), unnest(area_ids);
end;
$$;

revoke execute on function public.register_worker(text, text, text, integer, text, text[]) from public;
grant execute on function public.register_worker(text, text, text, integer, text, text[]) to authenticated;
