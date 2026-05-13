-- ============================================================
-- Migration: 0011_permit_requests_delete_policy.sql
-- Allow admins to delete permit_requests via RLS, and log deletes
-- ============================================================

-- ────────────────────────────────────────
-- 1. RLS: admin delete on permit_requests
-- ────────────────────────────────────────
drop policy if exists "permit_requests: admin delete" on public.permit_requests;

create policy "permit_requests: admin delete"
  on public.permit_requests for delete
  using (public.is_admin());

-- ────────────────────────────────────────
-- 2. Audit: log deletions to activity_log
--    (existing trigger only fires on INSERT/UPDATE)
-- ────────────────────────────────────────
create or replace function public.log_permit_request_deletion()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into activity_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'deleted',
      'permit_request',
      old.id,
      jsonb_build_object(
        'full_name', old.full_name,
        'entity_raw', old.entity_raw,
        'plate', old.plate,
        'status', old.status
      )
    );
  return old;
end $$;

drop trigger if exists permit_request_audit_delete on permit_requests;
create trigger permit_request_audit_delete
  after delete on permit_requests
  for each row execute function public.log_permit_request_deletion();
