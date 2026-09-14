-- Admin-only worker approval and rejection.

create or replace function public.review_worker(
  target_worker_id uuid,
  decision public.worker_approval_status,
  decision_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin   
  if not public.is_admin() then
    raise exception 'Only administrators can review workers';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid worker review decision';
  end if;

  update public.worker_profiles
  set approval_status = decision,
      rejection_reason = case when decision = 'rejected' then nullif(trim(decision_reason), '') else null end,
      approved_at = case when decision = 'approved' then timezone('utc', now()) else null end,
      updated_at = timezone('utc', now())
  where id = target_worker_id;

  if not found then
    raise exception 'Worker profile not found';
  end if;

  insert into public.admin_actions (admin_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    case when decision = 'approved' then 'worker_approved' else 'worker_rejected' end,
    'worker_profiles',
    target_worker_id,
    jsonb_build_object('reason', decision_reason)
  );
end;
$$;

revoke execute on function public.review_worker(uuid, public.worker_approval_status, text) from public;
grant execute on function public.review_worker(uuid, public.worker_approval_status, text) to authenticated;
