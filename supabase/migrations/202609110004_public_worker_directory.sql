-- Public directory exposes only approved, non-sensitive worker fields.
-- Phone numbers and verification documents are intentionally excluded.

create or replace view public.approved_worker_directory as
select
  wp.id,
  p.full_name as name,
  p.avatar_url as avatar,
  wp.bio,
  wp.experience_years as experience,
  wp.rating,
  wp.review_count as reviews,
  wp.is_available as available,
  array_remove(array_agg(distinct wc.category_id), null) as categories,
  array_remove(array_agg(distinct sa.pincode), null) as areas
from public.worker_profiles wp
join public.profiles p on p.id = wp.id
left join public.worker_categories wc on wc.worker_id = wp.id
left join public.worker_service_areas wsa on wsa.worker_id = wp.id
left join public.service_areas sa on sa.id = wsa.service_area_id
where wp.approval_status = 'approved'
group by wp.id, p.full_name, p.avatar_url, wp.bio, wp.experience_years, wp.rating, wp.review_count, wp.is_available;

grant select on public.approved_worker_directory to anon, authenticated;
