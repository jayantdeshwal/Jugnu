-- Optional customer problem images for Phase 3C service requests.
-- This is a separate attachment table so the existing quote/booking RPCs remain unchanged.

create table if not exists public.service_request_attachments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 8388608),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists service_request_attachments_request_idx
  on public.service_request_attachments(service_request_id);

alter table public.service_request_attachments enable row level security;
grant select, insert, delete on public.service_request_attachments to authenticated;

drop policy if exists "Request participants can read problem images" on public.service_request_attachments;
create policy "Request participants can read problem images"
on public.service_request_attachments for select
using (
  customer_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.booking_quote_requests bqr
    where bqr.service_request_id = service_request_attachments.service_request_id
      and bqr.worker_id = auth.uid()
  )
);

drop policy if exists "Customers can attach their problem images" on public.service_request_attachments;
create policy "Customers can attach their problem images"
on public.service_request_attachments for insert
with check (
  customer_id = auth.uid()
  and exists (
    select 1
    from public.service_requests sr
    where sr.id = service_request_attachments.service_request_id
      and sr.customer_id = auth.uid()
  )
);

drop policy if exists "Customers can remove their problem images" on public.service_request_attachments;
create policy "Customers can remove their problem images"
on public.service_request_attachments for delete
using (customer_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-request-images',
  'service-request-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Customers can upload problem images" on storage.objects;
create policy "Customers can upload problem images"
on storage.objects for insert
with check (
  bucket_id = 'service-request-images'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.service_requests sr
    where sr.id::text = (storage.foldername(name))[2]
      and sr.customer_id = auth.uid()
  )
);

drop policy if exists "Request participants can view problem images" on storage.objects;
create policy "Request participants can view problem images"
on storage.objects for select
using (
  bucket_id = 'service-request-images'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1
      from public.service_request_attachments a
      join public.booking_quote_requests bqr on bqr.service_request_id = a.service_request_id
      where a.storage_path = name
        and bqr.worker_id = auth.uid()
    )
  )
);

drop policy if exists "Customers can delete problem images" on storage.objects;
create policy "Customers can delete problem images"
on storage.objects for delete
using (
  bucket_id = 'service-request-images'
  and (public.is_admin() or auth.uid()::text = (storage.foldername(name))[1])
);

-- Workers need the request description/image only after they are quote participants.
-- Customer/admin access remains unchanged.
drop policy if exists "Customers and admins can read service requests" on public.service_requests;
create policy "Customers, quote participants and admins can read service requests"
on public.service_requests for select
using (
  customer_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.booking_quote_requests bqr
    where bqr.service_request_id = service_requests.id
      and bqr.worker_id = auth.uid()
  )
);
