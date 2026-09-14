-- Allow workers to toggle their own availability status.

create or replace function public.update_worker_availability(
  target_available boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update availability';
  end if;

  update public.worker_profiles
  set is_available = target_available,
      updated_at = timezone('utc', now())
  where id = auth.uid();

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    raise exception 'Worker profile not found for current user';
  end if;
end;
$$;

revoke execute on function public.update_worker_availability(boolean) from public;
grant execute on function public.update_worker_availability(boolean) to authenticated;
