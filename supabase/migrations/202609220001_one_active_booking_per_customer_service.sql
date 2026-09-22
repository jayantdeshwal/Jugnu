-- Enforce one active service request or booking per customer and service.
-- Active booking statuses: pending, accepted, in_progress, disputed.
-- Active service-request status: open.
-- The registry is shared by both tables so the rule also holds while a
-- service request is atomically converted into a booking.

do $$
declare
  v_conflicts text;
begin
  with active_rows as (
    select customer_id, category_id, 'service_request'::text as source, id as record_id
    from public.service_requests
    where status = 'open'
    union all
    select customer_id, category_id, 'booking'::text as source, id as record_id
    from public.bookings
    where status::text in ('pending', 'accepted', 'in_progress', 'disputed')
  ), conflicts as (
    select customer_id,
           category_id,
           count(*) as row_count,
           string_agg(source || ':' || record_id::text, ', ' order by source, record_id) as records
    from active_rows
    group by customer_id, category_id
    having count(*) > 1
  )
  select string_agg(
    format('customer=%s service=%s records=%s', customer_id, category_id, records),
    '; '
  )
  into v_conflicts
  from conflicts;

  if v_conflicts is not null then
    raise exception using
      message = 'ACTIVE_SERVICE_DUPLICATES_EXIST',
      detail = v_conflicts,
      hint = 'Resolve the listed active records before applying this migration.';
  end if;
end;
$$;

create table public.customer_service_active_slots (
  customer_id uuid not null references public.profiles(id) on delete restrict,
  category_id text not null references public.categories(id) on delete restrict,
  source text not null check (source in ('service_request', 'booking')),
  service_request_id uuid unique references public.service_requests(id) on delete cascade,
  booking_id uuid unique references public.bookings(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (customer_id, category_id),
  constraint customer_service_active_slots_source_ref check (
    (source = 'service_request' and service_request_id is not null and booking_id is null)
    or (source = 'booking' and booking_id is not null and service_request_id is null)
  )
);

alter table public.customer_service_active_slots enable row level security;
revoke all on public.customer_service_active_slots from public, anon, authenticated;

insert into public.customer_service_active_slots (customer_id, category_id, source, service_request_id)
select customer_id, category_id, 'service_request', id
from public.service_requests
where status = 'open';

insert into public.customer_service_active_slots (customer_id, category_id, source, booking_id)
select customer_id, category_id, 'booking', id
from public.bookings
where status::text in ('pending', 'accepted', 'in_progress', 'disputed');

create or replace function public.raise_active_service_request_exists()
returns void
language plpgsql
immutable
as $$
begin
  raise exception using
    message = 'ACTIVE_SERVICE_REQUEST_EXISTS',
    detail = 'You already have an active request for this service.';
end;
$$;
revoke execute on function public.raise_active_service_request_exists() from public, anon, authenticated;

create or replace function public.claim_service_request_active_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'open' then
    begin
      insert into public.customer_service_active_slots (
        customer_id, category_id, source, service_request_id
      ) values (
        new.customer_id, new.category_id, 'service_request', new.id
      );
    exception when unique_violation then
      perform public.raise_active_service_request_exists();
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.claim_service_request_active_slot() from public, anon, authenticated;

create or replace function public.release_service_request_active_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'open' and new.status <> 'open' then
    delete from public.customer_service_active_slots
    where service_request_id = new.id
      and source = 'service_request';
  end if;
  return new;
end;
$$;
revoke execute on function public.release_service_request_active_slot() from public, anon, authenticated;

create or replace function public.claim_booking_active_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.customer_service_active_slots%rowtype;
begin
  if new.status::text in ('pending', 'accepted', 'in_progress', 'disputed') then
    select * into v_slot
    from public.customer_service_active_slots
    where customer_id = new.customer_id
      and category_id = new.category_id
    for update;

    if v_slot.customer_id is null then
      begin
        insert into public.customer_service_active_slots (
          customer_id, category_id, source, booking_id
        ) values (
          new.customer_id, new.category_id, 'booking', new.id
        );
      exception when unique_violation then
        perform public.raise_active_service_request_exists();
      end;
    elsif v_slot.source = 'service_request' then
      update public.customer_service_active_slots
      set source = 'booking', booking_id = new.id, service_request_id = null
      where customer_id = new.customer_id
        and category_id = new.category_id;
    elsif v_slot.booking_id is distinct from new.id then
      perform public.raise_active_service_request_exists();
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.claim_booking_active_slot() from public, anon, authenticated;

create or replace function public.release_booking_active_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status::text in ('pending', 'accepted', 'in_progress', 'disputed')
     and new.status::text not in ('pending', 'accepted', 'in_progress', 'disputed') then
    delete from public.customer_service_active_slots
    where booking_id = old.id
      and source = 'booking';
  end if;
  return new;
end;
$$;
revoke execute on function public.release_booking_active_slot() from public, anon, authenticated;

drop trigger if exists trg_claim_service_request_active_slot on public.service_requests;
create trigger trg_claim_service_request_active_slot
before insert or update of customer_id, category_id, status on public.service_requests
for each row execute function public.claim_service_request_active_slot();

drop trigger if exists trg_release_service_request_active_slot on public.service_requests;
create trigger trg_release_service_request_active_slot
after update of status on public.service_requests
for each row execute function public.release_service_request_active_slot();

drop trigger if exists trg_claim_booking_active_slot on public.bookings;
create trigger trg_claim_booking_active_slot
before insert or update of customer_id, category_id, status on public.bookings
for each row execute function public.claim_booking_active_slot();

drop trigger if exists trg_release_booking_active_slot on public.bookings;
create trigger trg_release_booking_active_slot
after update of status on public.bookings
for each row execute function public.release_booking_active_slot();

create or replace function public.create_service_request(
  target_category_id text,
  target_pincode text,
  target_scheduled_for timestamptz,
  target_address text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area_id uuid;
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to request a quote';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'Only customers can create service requests';
  end if;
  if not exists (select 1 from public.categories where id = target_category_id) then
    raise exception 'Selected service is invalid';
  end if;
  if exists (
    select 1 from public.customer_service_active_slots
    where customer_id = auth.uid() and category_id = target_category_id
  ) then
    perform public.raise_active_service_request_exists();
  end if;
  select id into v_area_id from public.service_areas where pincode = trim(target_pincode);
  if v_area_id is null then
    raise exception 'This service area is not supported yet';
  end if;
  if target_scheduled_for is null or target_scheduled_for <= timezone('utc', now()) then
    raise exception 'Scheduled time must be in the future';
  end if;
  if target_address is null or char_length(trim(target_address)) = 0 then
    raise exception 'Address is required';
  end if;

  insert into public.service_requests (customer_id, category_id, service_area_id, pincode, scheduled_for, address, notes)
  values (auth.uid(), target_category_id, v_area_id, trim(target_pincode), target_scheduled_for, trim(target_address), nullif(trim(target_notes), ''))
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.create_booking_quote_request(
  target_service_request_id uuid,
  target_worker_id uuid,
  target_response_deadline_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_request_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to request a quote'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'Only customers can request a quote';
  end if;
  if target_response_deadline_at is null or target_response_deadline_at <= timezone('utc', now()) then
    raise exception 'Response deadline must be in the future';
  end if;

  select * into v_request
  from public.service_requests
  where id = target_service_request_id and customer_id = auth.uid()
  for update;
  if v_request.id is null or v_request.status <> 'open' then
    raise exception 'Service request was not found or is no longer open';
  end if;

  if exists (
    select 1 from public.customer_service_active_slots
    where customer_id = v_request.customer_id
      and category_id = v_request.category_id
      and source = 'booking'
  ) then
    perform public.raise_active_service_request_exists();
  end if;

  update public.booking_quote_requests as bqr
  set status = 'expired', updated_at = timezone('utc', now())
  where service_request_id = target_service_request_id
    and exists (
      select 1 from public.service_requests sr
      where sr.id = bqr.service_request_id and sr.customer_id = auth.uid()
    )
    and status = 'pending'
    and response_deadline_at <= timezone('utc', now());

  if not exists (
    select 1
    from public.worker_profiles wp
    join public.worker_categories wc on wc.worker_id = wp.id and wc.category_id = v_request.category_id
    join public.worker_service_areas wsa on wsa.worker_id = wp.id and wsa.service_area_id = v_request.service_area_id
    where wp.id = target_worker_id
      and wp.approval_status = 'approved'
      and wp.is_available = true
  ) then
    raise exception 'Selected provider is not eligible for this service request';
  end if;

  insert into public.booking_quote_requests (service_request_id, customer_id, worker_id, response_deadline_at)
  values (v_request.id, auth.uid(), target_worker_id, target_response_deadline_at)
  returning id into v_request_id;
  return v_request_id;
exception
  when unique_violation then
    raise exception 'An active provider quote request already exists for this service request';
end;
$$;

create or replace function public.create_booking(
  target_worker_id uuid,
  target_category_id text,
  target_pincode text,
  target_scheduled_at timestamptz,
  target_address text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_booking_id uuid;
  target_area_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a booking';
  end if;

  if exists (
    select 1 from public.customer_service_active_slots
    where customer_id = auth.uid()
      and category_id = target_category_id
      and source = 'booking'
  ) then
    perform public.raise_active_service_request_exists();
  end if;

  select id into target_area_id
  from public.service_areas
  where pincode = target_pincode;
  if target_area_id is null then
    raise exception 'This service area is not supported yet';
  end if;

  if not exists (
    select 1 from public.worker_profiles wp
    join public.worker_categories wc on wc.worker_id = wp.id
    join public.worker_service_areas wsa on wsa.worker_id = wp.id
    where wp.id = target_worker_id
      and wp.approval_status = 'approved'
      and wp.is_available = true
      and wc.category_id = target_category_id
      and wsa.service_area_id = target_area_id
  ) then
    raise exception 'This worker is not available for the selected service area';
  end if;

  insert into public.bookings (
    customer_id, worker_id, category_id, service_area_id, scheduled_at, address, notes
  ) values (
    auth.uid(), target_worker_id, target_category_id, target_area_id,
    target_scheduled_at, trim(target_address), nullif(trim(target_notes), '')
  ) returning id into new_booking_id;

  return new_booking_id;
end;
$$;

revoke execute on function public.create_booking(uuid, text, text, timestamptz, text, text) from public;
revoke execute on function public.create_booking(uuid, text, text, timestamptz, text, text) from anon, authenticated;
