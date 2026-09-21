-- Phase 3C: pre-booking provider quotes.
-- A quote is accepted before public.bookings is created. Existing bookings
-- remain the canonical Job records and their security model is unchanged.

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  category_id text not null references public.categories(id) on delete restrict,
  service_area_id uuid not null references public.service_areas(id) on delete restrict,
  pincode text not null,
  scheduled_for timestamptz not null,
  address text not null check (char_length(trim(address)) between 1 and 2000),
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'open' check (status in ('open', 'fulfilled', 'cancelled', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_requests_pincode_check check (char_length(trim(pincode)) between 1 and 20)
);

create index service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index service_requests_open_idx on public.service_requests(status, category_id, service_area_id, created_at desc);

create table public.booking_quote_requests (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'quoted', 'rejected', 'cancelled', 'expired', 'accepted')),
  requested_at timestamptz not null default timezone('utc', now()),
  response_deadline_at timestamptz not null,
  cancelled_at timestamptz,
  rejected_at timestamptz,
  responded_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint booking_quote_requests_dates check (response_deadline_at > requested_at)
);

create unique index booking_quote_requests_one_active_per_service_request
  on public.booking_quote_requests(service_request_id)
  where status in ('pending', 'quoted');

create index booking_quote_requests_worker_idx on public.booking_quote_requests(worker_id, status, requested_at desc);
create index booking_quote_requests_customer_idx on public.booking_quote_requests(customer_id, status, requested_at desc);

create table public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.booking_quote_requests(id) on delete cascade,
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected', 'cancelled')),
  submitted_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint booking_quotes_request_service_consistent check (service_request_id is not null),
  constraint booking_quotes_request_worker_consistent check (worker_id is not null)
);

create unique index booking_quotes_one_submitted_per_request
  on public.booking_quotes(quote_request_id)
  where status = 'submitted';

create index booking_quotes_service_request_idx on public.booking_quotes(service_request_id, created_at desc);

alter table public.service_requests enable row level security;
alter table public.booking_quote_requests enable row level security;
alter table public.booking_quotes enable row level security;

grant select on public.service_requests, public.booking_quote_requests, public.booking_quotes to authenticated;

create policy "Customers and admins can read service requests"
on public.service_requests for select
using (customer_id = auth.uid() or public.is_admin());

create policy "Quote participants and admins can read quote requests"
on public.booking_quote_requests for select
using (customer_id = auth.uid() or worker_id = auth.uid() or public.is_admin());

create policy "Quote participants and admins can read quotes"
on public.booking_quotes for select
using (
  worker_id = auth.uid()
  or exists (
    select 1 from public.booking_quote_requests r
    where r.id = quote_request_id and r.customer_id = auth.uid()
  )
  or public.is_admin()
);

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

  update public.booking_quote_requests as bqr
  set status = 'expired', updated_at = timezone('utc', now())
  where service_request_id = target_service_request_id
    and exists (
      select 1 from public.service_requests sr
      where sr.id = bqr.service_request_id and sr.customer_id = auth.uid()
    )
    and status in ('pending', 'quoted')
    and response_deadline_at <= timezone('utc', now());

  select * into v_request
  from public.service_requests
  where id = target_service_request_id and customer_id = auth.uid()
  for update;
  if v_request.id is null or v_request.status <> 'open' then
    raise exception 'Service request was not found or is no longer open';
  end if;

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

create or replace function public.cancel_booking_quote_request(
  target_quote_request_id uuid,
  target_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in to cancel a quote request'; end if;
  update public.booking_quote_requests as bqr
  set status = 'expired', updated_at = timezone('utc', now())
  where id = target_quote_request_id
    and customer_id = auth.uid()
    and status in ('pending', 'quoted')
    and response_deadline_at <= timezone('utc', now());
  if found then return; end if;
  update public.booking_quote_requests as bqr
  set status = 'cancelled', cancelled_at = timezone('utc', now()), cancellation_reason = nullif(trim(target_reason), ''), updated_at = timezone('utc', now())
  where id = target_quote_request_id
    and customer_id = auth.uid()
    and status in ('pending', 'quoted');
  if not found then raise exception 'Quote request was not found or can no longer be cancelled'; end if;
end;
$$;

create or replace function public.respond_to_booking_quote_request(
  target_quote_request_id uuid,
  target_action text,
  target_amount numeric default null,
  target_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.booking_quote_requests%rowtype;
  v_quote_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to respond to a quote request'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'worker') then
    raise exception 'Only providers can respond to quote requests';
  end if;

  select * into v_request from public.booking_quote_requests
  where id = target_quote_request_id and worker_id = auth.uid()
  for update;
  if v_request.id is null then raise exception 'Quote request was not found or is not assigned to you'; end if;
  if v_request.status <> 'pending' then raise exception 'This quote request is no longer awaiting a response'; end if;
  if v_request.response_deadline_at <= timezone('utc', now()) then
    update public.booking_quote_requests set status = 'expired', updated_at = timezone('utc', now()) where id = v_request.id;
    raise exception 'The response deadline has passed';
  end if;
  if target_action not in ('reject', 'quote') then raise exception 'Invalid quote response'; end if;

  if target_action = 'reject' then
    update public.booking_quote_requests
    set status = 'rejected', rejected_at = timezone('utc', now()), responded_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = v_request.id;
    return null;
  end if;

  if target_amount is null or target_amount <= 0 then raise exception 'Quote amount must be greater than zero'; end if;
  insert into public.booking_quotes (quote_request_id, service_request_id, worker_id, amount, details)
  values (v_request.id, v_request.service_request_id, auth.uid(), target_amount, nullif(trim(target_details), ''))
  returning id into v_quote_id;
  update public.booking_quote_requests
  set status = 'quoted', responded_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = v_request.id;
  return v_quote_id;
end;
$$;

create or replace function public.accept_booking_quote(target_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.booking_quotes%rowtype;
  v_request public.booking_quote_requests%rowtype;
  v_service public.service_requests%rowtype;
  v_booking_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to accept a quote'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'Only customers can accept quotes';
  end if;

  select * into v_quote from public.booking_quotes where id = target_quote_id for update;
  if v_quote.id is null then raise exception 'Quote was not found'; end if;
  select * into v_request from public.booking_quote_requests where id = v_quote.quote_request_id for update;
  select * into v_service from public.service_requests where id = v_quote.service_request_id and customer_id = auth.uid() for update;
  if v_service.id is null or v_request.customer_id <> auth.uid() then raise exception 'Quote does not belong to you'; end if;
  if v_service.status <> 'open' or v_request.status <> 'quoted' or v_quote.status <> 'submitted' then
    raise exception 'This quote is no longer available';
  end if;
  
  v_booking_id := public.create_booking(v_request.worker_id, v_service.category_id, v_service.pincode, v_service.scheduled_for, v_service.address, v_service.notes);

  update public.booking_quotes set status = 'accepted', accepted_at = timezone('utc', now()), booking_id = v_booking_id, updated_at = timezone('utc', now()) where id = v_quote.id;
  update public.booking_quote_requests set status = 'accepted', updated_at = timezone('utc', now()) where id = v_request.id;
  update public.service_requests set status = 'fulfilled', updated_at = timezone('utc', now()) where id = v_service.id;
  return v_booking_id;
end;
$$;

revoke execute on function public.create_service_request(text, text, timestamptz, text, text) from public;
grant execute on function public.create_service_request(text, text, timestamptz, text, text) to authenticated;
revoke execute on function public.create_booking_quote_request(uuid, uuid, timestamptz) from public;
grant execute on function public.create_booking_quote_request(uuid, uuid, timestamptz) to authenticated;
revoke execute on function public.cancel_booking_quote_request(uuid, text) from public;
grant execute on function public.cancel_booking_quote_request(uuid, text) to authenticated;
revoke execute on function public.respond_to_booking_quote_request(uuid, text, numeric, text) from public;
grant execute on function public.respond_to_booking_quote_request(uuid, text, numeric, text) to authenticated;
revoke execute on function public.accept_booking_quote(uuid) from public;
grant execute on function public.accept_booking_quote(uuid) to authenticated;

create or replace function public.handle_quote_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'booking_quote_requests' and tg_op = 'INSERT' then
    insert into public.notifications(user_id, notification_type, title, body)
    values (new.worker_id, 'quote_request_created', 'New quote request', 'A customer has asked you to submit a quote.');
  elsif tg_table_name = 'booking_quote_requests' and tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'cancelled' then
      insert into public.notifications(user_id, notification_type, title, body)
      values (new.worker_id, 'quote_request_cancelled', 'Quote request cancelled', 'The customer cancelled this quote request.');
    elsif new.status = 'rejected' then
      insert into public.notifications(user_id, notification_type, title, body)
      values (new.customer_id, 'quote_request_rejected', 'Provider declined your quote request', 'The provider declined this quote request.');
    elsif new.status = 'expired' then
      insert into public.notifications(user_id, notification_type, title, body)
      values (new.customer_id, 'quote_request_expired', 'Quote request expired', 'This provider did not respond before the deadline.');
    elsif new.status = 'accepted' then
      insert into public.notifications(user_id, notification_type, title, body)
      values (new.worker_id, 'quote_accepted', 'Quote accepted', 'The customer accepted your quote and a booking was created.');
    end if;
  elsif tg_table_name = 'booking_quotes' and tg_op = 'INSERT' then
    insert into public.notifications(user_id, notification_type, title, body)
    select r.customer_id, 'quote_submitted', 'You received a quote', 'A provider submitted a quote for your service request.'
    from public.booking_quote_requests r where r.id = new.quote_request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quote_request_notification on public.booking_quote_requests;
create trigger trg_quote_request_notification
after insert or update of status on public.booking_quote_requests
for each row execute function public.handle_quote_notification();

drop trigger if exists trg_booking_quote_notification on public.booking_quotes;
create trigger trg_booking_quote_notification
after insert on public.booking_quotes
for each row execute function public.handle_quote_notification();
