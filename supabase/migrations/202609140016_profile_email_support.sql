-- Migration: Add optional email column to public.profiles and update handle_new_user

alter table public.profiles
add column if not exists email text;

-- Ensure handle_new_user stores email if provided via auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.phone,
    new.email
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
    updated_at = timezone('utc', now());
  return new;
end;
$$;
