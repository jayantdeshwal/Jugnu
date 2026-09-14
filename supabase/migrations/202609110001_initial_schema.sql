-- Initial domain schema for Muzaffarnagar Ka Kaamgar.
-- Apply this migration only after reviewing it in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer', 'worker', 'admin');
create type public.language_code as enum ('en', 'hi');
create type public.worker_approval_status as enum ('pending', 'approved', 'rejected');
create type public.booking_status as enum (
  'pending',
  'accepted',
  'rejected',
  'in_progress',
  'completed',
  'cancelled',
  'disputed'
);
create type public.complaint_status as enum ('open', 'investigating', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text unique,
  role public.user_role not null default 'customer',
  language public.language_code not null default 'en',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.categories (
  id text primary key,
  name_en text not null,
  name_hi text not null,
  icon text not null,
  sort_order integer not null default 0
);

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  district text not null default 'Muzaffarnagar',
  locality text not null,
  pincode text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.worker_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  bio text not null default '',
  experience_years integer not null default 0 check (experience_years >= 0),
  approval_status public.worker_approval_status not null default 'pending',
  rejection_reason text,
  is_available boolean not null default true,
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.worker_categories (
  worker_id uuid not null references public.worker_profiles(id) on delete cascade,
  category_id text not null references public.categories(id) on delete restrict,
  primary key (worker_id, category_id)
);

create table public.worker_service_areas (
  worker_id uuid not null references public.worker_profiles(id) on delete cascade,
  service_area_id uuid not null references public.service_areas(id) on delete restrict,
  primary key (worker_id, service_area_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  category_id text not null references public.categories(id) on delete restrict,
  service_area_id uuid references public.service_areas(id) on delete restrict,
  status public.booking_status not null default 'pending',
  scheduled_at timestamptz,
  address text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bookings_different_users check (customer_id <> worker_id),
  constraint bookings_id_customer_unique unique (id, customer_id)
);

create index bookings_customer_id_idx on public.bookings(customer_id, created_at desc);
create index bookings_worker_status_idx on public.bookings(worker_id, status, created_at desc);
create index worker_profiles_discovery_idx on public.worker_profiles(approval_status, is_available);
create index worker_categories_category_idx on public.worker_categories(category_id, worker_id);
create index worker_service_areas_area_idx on public.worker_service_areas(service_area_id, worker_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  constraint reviews_customer_is_booking_customer foreign key (booking_id, customer_id)
    references public.bookings(id, customer_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  against_user uuid not null references public.profiles(id) on delete restrict,
  status public.complaint_status not null default 'open',
  reason text not null,
  resolution_note text,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  target_table text not null,
  target_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.categories (id, name_en, name_hi, icon, sort_order) values
  ('electrician', 'Electrician', 'इलेक्ट्रीशियन', 'zap', 1),
  ('plumber', 'Plumber', 'प्लंबर', 'wrench', 2),
  ('carpenter', 'Carpenter', 'कारपेंटर', 'hammer', 3),
  ('ac', 'AC Technician', 'AC टेक्नीशियन', 'snowflake', 4),
  ('painter', 'Painter', 'पेंटर', 'brush', 5)
on conflict (id) do nothing;

insert into public.service_areas (district, locality, pincode) values
  ('Muzaffarnagar', 'City', '251001'),
  ('Muzaffarnagar', 'Cantt', '251002')
on conflict (pincode) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_accepted_booking(target_worker_id uuid, target_customer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.bookings
    where worker_id = target_worker_id
      and customer_id = target_customer_id
      and status in ('accepted', 'in_progress', 'completed', 'disputed')
  );
$$;

create or replace function public.get_worker_contact(target_worker_id uuid)
returns table (worker_id uuid, phone text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.phone
  from public.profiles p
  where p.id = target_worker_id
    and p.role = 'worker'
    and public.has_accepted_booking(target_worker_id, auth.uid());
$$;

revoke execute on function public.get_worker_contact(uuid) from public;
grant execute on function public.get_worker_contact(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.service_areas enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.worker_categories enable row level security;
alter table public.worker_service_areas enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.complaints enable row level security;
alter table public.admin_actions enable row level security;

create policy "Anyone can read categories"
on public.categories for select using (true);

create policy "Anyone can read service areas"
on public.service_areas for select using (true);

create policy "Anyone can read approved worker profiles"
on public.worker_profiles for select
using (approval_status = 'approved');

create policy "Workers can read their own worker profile"
on public.worker_profiles for select
using (id = auth.uid());

create policy "Admins can read all worker profiles"
on public.worker_profiles for select
using (public.is_admin());

create policy "Anyone can read approved worker categories"
on public.worker_categories for select
using (exists (
  select 1 from public.worker_profiles wp
  where wp.id = worker_id and wp.approval_status = 'approved'
));

create policy "Anyone can read approved worker areas"
on public.worker_service_areas for select
using (exists (
  select 1 from public.worker_profiles wp
  where wp.id = worker_id and wp.approval_status = 'approved'
));

create policy "Users can read their own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "Users can update their own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Workers can create their worker profile"
on public.worker_profiles for insert
with check (id = auth.uid());

create policy "Workers can update their own worker profile"
on public.worker_profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Customers can create their own bookings"
on public.bookings for insert
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.worker_profiles wp
    where wp.id = worker_id and wp.approval_status = 'approved'
  )
);

create policy "Customers and assigned workers can read bookings"
on public.bookings for select
using (customer_id = auth.uid() or worker_id = auth.uid() or public.is_admin());

create policy "Workers can update assigned bookings"
on public.bookings for update
using (worker_id = auth.uid())
with check (worker_id = auth.uid());

create policy "Customers can read their reviews"
on public.reviews for select
using (customer_id = auth.uid() or worker_id = auth.uid() or public.is_admin());

create policy "Customers can review their completed bookings"
on public.reviews for insert
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.customer_id = auth.uid()
      and b.worker_id = worker_id
      and b.status = 'completed'
  )
);

create policy "Users can read their notifications"
on public.notifications for select
using (user_id = auth.uid() or public.is_admin());

create policy "Users can mark their notifications read"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Booking participants can create complaints"
on public.complaints for insert
with check (
  opened_by = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.customer_id = auth.uid() or b.worker_id = auth.uid())
  )
);

create policy "Complaint participants and admins can read complaints"
on public.complaints for select
using (opened_by = auth.uid() or against_user = auth.uid() or public.is_admin());

create policy "Admins can manage complaints"
on public.complaints for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage admin actions"
on public.admin_actions for all
using (public.is_admin())
with check (public.is_admin());
