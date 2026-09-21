-- Phase 3C targeted security and lifecycle hardening.
-- Keep the original Phase 3C migration immutable.

-- Normal authenticated clients must enter the booking flow through
-- accept_booking_quote(). The existing function remains available to trusted
-- server-side callers and retains its existing booking validations.
revoke execute on function public.create_booking(uuid, text, text, timestamptz, text, text)
  from public, anon, authenticated;

-- Enforce that denormalized quote fields match their quote request.
alter table public.booking_quote_requests
  add constraint booking_quote_requests_id_service_request_unique
  unique (id, service_request_id);

alter table public.booking_quote_requests
  add constraint booking_quote_requests_id_worker_unique
  unique (id, worker_id);

alter table public.booking_quotes
  drop constraint if exists booking_quotes_request_service_consistent;

alter table public.booking_quotes
  drop constraint if exists booking_quotes_request_worker_consistent;

alter table public.booking_quotes
  add constraint booking_quotes_request_service_fk
  foreign key (quote_request_id, service_request_id)
  references public.booking_quote_requests (id, service_request_id);

alter table public.booking_quotes
  add constraint booking_quotes_request_worker_fk
  foreign key (quote_request_id, worker_id)
  references public.booking_quote_requests (id, worker_id);

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

  -- Only unanswered requests expire. Once a provider has submitted a quote,
  -- the response deadline no longer invalidates that submitted quote.
  update public.booking_quote_requests as bqr
  set status = 'expired', updated_at = timezone('utc', now())
  where service_request_id = target_service_request_id
    and exists (
      select 1 from public.service_requests sr
      where sr.id = bqr.service_request_id and sr.customer_id = auth.uid()
    )
    and status = 'pending'
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
declare
  v_status text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to cancel a quote request'; end if;

  select status into v_status
  from public.booking_quote_requests
  where id = target_quote_request_id and customer_id = auth.uid()
  for update;

  if v_status is null then raise exception 'Quote request was not found or can no longer be cancelled'; end if;

  if v_status = 'pending' and exists (
    select 1 from public.booking_quote_requests
    where id = target_quote_request_id
      and response_deadline_at <= timezone('utc', now())
  ) then
    update public.booking_quote_requests
    set status = 'expired', updated_at = timezone('utc', now())
    where id = target_quote_request_id;
    return;
  end if;

  if v_status not in ('pending', 'quoted') then
    raise exception 'Quote request was not found or can no longer be cancelled';
  end if;

  update public.booking_quotes
  set status = 'cancelled', updated_at = timezone('utc', now())
  where quote_request_id = target_quote_request_id and status = 'submitted';

  update public.booking_quote_requests
  set status = 'cancelled', cancelled_at = timezone('utc', now()),
      cancellation_reason = nullif(trim(target_reason), ''), updated_at = timezone('utc', now())
  where id = target_quote_request_id;
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
    -- Commit the terminal state instead of updating and then raising, which
    -- would roll the expiry update back with the exception.
    update public.booking_quote_requests
    set status = 'expired', updated_at = timezone('utc', now())
    where id = v_request.id;
    return null;
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
  if v_request.id is null then raise exception 'Quote request was not found'; end if;

  if v_quote.worker_id <> v_request.worker_id
     or v_quote.service_request_id <> v_request.service_request_id then
    raise exception 'Quote ownership is inconsistent with its request';
  end if;

  select * into v_service from public.service_requests
  where id = v_request.service_request_id and customer_id = auth.uid()
  for update;
  if v_service.id is null or v_request.customer_id <> auth.uid() then raise exception 'Quote does not belong to you'; end if;
  if v_service.status <> 'open' or v_request.status <> 'quoted' or v_quote.status <> 'submitted' then
    raise exception 'This quote is no longer available';
  end if;

  -- This trusted SECURITY DEFINER call retains the existing booking
  -- validation and is no longer executable by ordinary authenticated clients.
  v_booking_id := public.create_booking(v_request.worker_id, v_service.category_id, v_service.pincode, v_service.scheduled_for, v_service.address, v_service.notes);

  update public.booking_quotes set status = 'accepted', accepted_at = timezone('utc', now()), booking_id = v_booking_id, updated_at = timezone('utc', now()) where id = v_quote.id;
  update public.booking_quote_requests set status = 'accepted', updated_at = timezone('utc', now()) where id = v_request.id;
  update public.service_requests set status = 'fulfilled', updated_at = timezone('utc', now()) where id = v_service.id;
  return v_booking_id;
end;
$$;

revoke execute on function public.create_booking_quote_request(uuid, uuid, timestamptz) from public;
grant execute on function public.create_booking_quote_request(uuid, uuid, timestamptz) to authenticated;
revoke execute on function public.cancel_booking_quote_request(uuid, text) from public;
grant execute on function public.cancel_booking_quote_request(uuid, text) to authenticated;
revoke execute on function public.respond_to_booking_quote_request(uuid, text, numeric, text) from public;
grant execute on function public.respond_to_booking_quote_request(uuid, text, numeric, text) to authenticated;
revoke execute on function public.accept_booking_quote(uuid) from public;
grant execute on function public.accept_booking_quote(uuid) to authenticated;
