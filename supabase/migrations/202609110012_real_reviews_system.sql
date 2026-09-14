-- Phase 7: Real Reviews & Ratings System
-- 1. Public read policy for verified customer reviews
-- 2. submit_booking_review RPC for customer submissions
-- 3. Automatic worker rating & review count recalculation trigger
-- 4. Review notification trigger alerting the worker

-- Allow anyone to read reviews so worker profiles show public customer feedback
drop policy if exists "Customers can read their reviews" on public.reviews;
drop policy if exists "Anyone can read reviews" on public.reviews;

create policy "Anyone can read reviews"
on public.reviews for select
using (true);

-- Trigger function: Recalculate worker rating and review_count on review changes
create or replace function public.recalculate_worker_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_avg_rating numeric;
  v_review_count integer;
begin
  v_worker_id := coalesce(new.worker_id, old.worker_id);

  select
    coalesce(round(avg(rating)::numeric, 2), 0),
    count(*)
  into v_avg_rating, v_review_count
  from public.reviews
  where worker_id = v_worker_id;

  update public.worker_profiles
  set
    rating = v_avg_rating,
    review_count = v_review_count,
    updated_at = timezone('utc', now())
  where id = v_worker_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalculate_worker_rating on public.reviews;
create trigger trg_recalculate_worker_rating
after insert or update or delete on public.reviews
for each row
execute function public.recalculate_worker_rating();

-- Trigger function: Notify worker when customer submits a review
create or replace function public.handle_review_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text;
begin
  select coalesce(nullif(trim(full_name), ''), 'A customer')
  into v_customer_name
  from public.profiles
  where id = new.customer_id;

  insert into public.notifications (
    user_id,
    booking_id,
    notification_type,
    title,
    body
  ) values (
    new.worker_id,
    new.booking_id,
    'review_received',
    'New Review Received (' || new.rating || '★)',
    v_customer_name || ' gave you a ' || new.rating || '★ review: "' || coalesce(nullif(trim(new.comment), ''), 'Great service') || '"'
  );

  return new;
end;
$$;

drop trigger if exists trg_review_notification on public.reviews;
create trigger trg_review_notification
after insert on public.reviews
for each row
execute function public.handle_review_notification();

-- RPC: Customer submits a review for a completed booking
create or replace function public.submit_booking_review(
  target_booking_id uuid,
  target_rating integer,
  target_comment text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_review_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to review a booking';
  end if;

  if target_rating < 1 or target_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into v_booking
  from public.bookings
  where id = target_booking_id
    and customer_id = auth.uid();

  if v_booking.id is null then
    raise exception 'Booking was not found or does not belong to you';
  end if;

  if v_booking.status <> 'completed' then
    raise exception 'You can only review completed bookings';
  end if;

  if exists (select 1 from public.reviews where booking_id = target_booking_id) then
    raise exception 'A review has already been submitted for this booking';
  end if;

  insert into public.reviews (
    booking_id,
    customer_id,
    worker_id,
    rating,
    comment
  ) values (
    v_booking.id,
    auth.uid(),
    v_booking.worker_id,
    target_rating,
    coalesce(trim(target_comment), '')
  )
  returning id into v_review_id;

  return v_review_id;
end;
$$;

revoke execute on function public.submit_booking_review(uuid, integer, text) from public;
grant execute on function public.submit_booking_review(uuid, integer, text) to authenticated;
