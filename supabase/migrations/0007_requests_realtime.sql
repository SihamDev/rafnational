-- Migration 0007: Enable realtime on permit_requests + performance indices

-- Enable realtime for the admin requests table
alter publication supabase_realtime add table permit_requests;

-- Composite index for common admin filter patterns (status + date)
create index if not exists permit_requests_status_created_idx
  on permit_requests (status, created_at desc);

-- Index for entity-based filter
create index if not exists permit_requests_entity_id_idx
  on permit_requests (entity_id)
  where entity_id is not null;

-- Index for duplicate detection (same plate or email)
create index if not exists permit_requests_plate_idx
  on permit_requests (plate);

create index if not exists permit_requests_email_idx
  on permit_requests (email);

-- Index for "guest only" filter
create index if not exists permit_requests_user_id_null_idx
  on permit_requests (created_at desc)
  where user_id is null;

-- RPC: get duplicate plate/email counts for a set of requests
-- used to show "مكرر" badge
create or replace function public.get_duplicate_flags(request_ids uuid[])
returns table(id uuid, plate_count bigint, email_count bigint)
language sql stable security definer set search_path = public
as $$
  select
    r.id,
    (select count(*) from permit_requests p where p.plate = r.plate and p.id <> r.id) as plate_count,
    (select count(*) from permit_requests p where p.email = r.email and p.id <> r.id) as email_count
  from permit_requests r
  where r.id = any(request_ids);
$$;

grant execute on function public.get_duplicate_flags(uuid[]) to authenticated;
