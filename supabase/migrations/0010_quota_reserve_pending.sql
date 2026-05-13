-- ============================================================
-- Migration: 0010_quota_reserve_pending.sql
-- Change quota policy: pending requests now reserve quota
-- used = approved + pending (not approved only)
-- ============================================================

-- ────────────────────────────────────────
-- Step 1: Raise every entity's permit_quota to cover current
--         pending+approved load (ceiling * 1.2 buffer).
--         This prevents immediate quota violations.
-- ────────────────────────────────────────
update entities e
   set permit_quota = greatest(
         e.permit_quota,
         ceil(
           coalesce((
             select count(*)
               from permit_requests r
              where r.entity_id = e.id
                and r.status in ('pending','approved')
           ), 0) * 1.2
         )::int
       )
 where exists (
   select 1 from permit_requests r
    where r.entity_id = e.id and r.status in ('pending','approved')
 );

-- Ensure minimum quota of 5 for all entities
update entities set permit_quota = greatest(permit_quota, 5);

-- ────────────────────────────────────────
-- Step 2: Replace entity_quota_stats view
--   used      = approved + pending  (actual reservation)
--   remaining = quota - used
--   approved_count, pending_count, rejected_count exposed separately
-- ────────────────────────────────────────
-- Drop first because column names changed (can't use CREATE OR REPLACE)
drop view if exists entity_quota_stats cascade;

create view entity_quota_stats as
select
  e.id,
  e.name,
  e.status,
  e.permit_quota,
  e.aliases,
  e.notes,
  e.created_at,
  coalesce(sum(case when r.status = 'approved' then 1 else 0 end), 0)::int as approved_count,
  coalesce(sum(case when r.status = 'pending'  then 1 else 0 end), 0)::int as pending_count,
  coalesce(sum(case when r.status = 'rejected' then 1 else 0 end), 0)::int as rejected_count,
  -- used = approved + pending (both consume quota)
  coalesce(sum(case when r.status in ('approved','pending') then 1 else 0 end), 0)::int as used,
  greatest(
    e.permit_quota
      - coalesce(sum(case when r.status in ('approved','pending') then 1 else 0 end), 0),
    0
  )::int as remaining
from entities e
left join permit_requests r on r.entity_id = e.id
group by e.id;

-- ────────────────────────────────────────
-- Step 3: Update get_entity_quota RPC to return new fields
-- ────────────────────────────────────────
drop function if exists public.get_entity_quota(uuid);
create function public.get_entity_quota(p_entity_id uuid)
returns table(
  used          int,
  remaining     int,
  permit_quota  int,
  entity_name   text,
  approved_count int,
  pending_count  int,
  rejected_count int,
  is_exhausted   boolean
)
language sql stable security definer
set search_path = public
as $$
  select
    used,
    remaining,
    permit_quota,
    name as entity_name,
    approved_count,
    pending_count,
    rejected_count,
    (remaining = 0) as is_exhausted
  from entity_quota_stats
  where id = p_entity_id;
$$;

grant execute on function public.get_entity_quota(uuid) to authenticated;
grant execute on function public.get_entity_quota(uuid) to anon;

-- ────────────────────────────────────────
-- Step 4: Update search_entities RPC to return quota info
-- ────────────────────────────────────────
drop function if exists public.search_entities(text);
create function public.search_entities(q text)
returns table(
  id           uuid,
  name         text,
  status       entity_status,
  permit_quota int,
  used         int,
  remaining    int,
  is_exhausted boolean
)
language sql stable security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.status,
    s.permit_quota,
    s.used,
    s.remaining,
    (s.remaining = 0) as is_exhausted
  from entity_quota_stats s
  where s.status = 'active'
    and (
      s.name ilike '%' || q || '%'
      or exists (
        select 1 from unnest(s.aliases) a where a ilike '%' || q || '%'
      )
    )
  order by similarity(s.name, q) desc, s.name
  limit 10;
$$;

grant execute on function public.search_entities(text) to anon, authenticated;

-- ────────────────────────────────────────
-- Step 5: Replace enforce_entity_quota (UPDATE trigger)
--   Fires when status changes TO pending/approved FROM rejected/null
-- ────────────────────────────────────────
create or replace function public.enforce_entity_quota()
returns trigger language plpgsql as $$
declare
  q        int;
  used_cnt int;
  ename    text;
begin
  -- Only check when transitioning INTO an active-consuming state
  if new.status in ('approved', 'pending')
     and (old.status is null or old.status not in ('approved', 'pending'))
     and new.entity_id is not null
  then
    select e.permit_quota, e.name, e.status
      into q, ename
      from entities e
     where e.id = new.entity_id;

    -- Skip quota check for entities still pending_review
    if (select status from entities where id = new.entity_id) = 'pending_review' then
      return new;
    end if;

    select count(*) into used_cnt
      from permit_requests
     where entity_id = new.entity_id
       and status in ('approved', 'pending')
       and id <> new.id;

    if used_cnt >= q then
      raise exception 'تجاوزت الجهة "%" الحد المسموح (% تصاريح). لا يمكن تقديم طلب جديد.', ename, q;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists permit_requests_enforce_quota on permit_requests;
create trigger permit_requests_enforce_quota
  before update on permit_requests
  for each row execute function public.enforce_entity_quota();

-- ────────────────────────────────────────
-- Step 6: Add INSERT trigger to enforce quota at submission time
-- ────────────────────────────────────────
create or replace function public.enforce_entity_quota_on_insert()
returns trigger language plpgsql as $$
declare
  q        int;
  used_cnt int;
  ename    text;
  estatus  entity_status;
begin
  if new.status = 'pending' and new.entity_id is not null then
    select e.permit_quota, e.name, e.status
      into q, ename, estatus
      from entities e
     where e.id = new.entity_id;

    -- Skip check for pending_review entities (quota not yet set)
    if estatus = 'pending_review' then
      return new;
    end if;

    select count(*) into used_cnt
      from permit_requests
     where entity_id = new.entity_id
       and status in ('approved', 'pending');

    if used_cnt >= q then
      raise exception 'تم استنفاد حصة الجهة "%" (% تصاريح). لا يمكن تقديم طلب جديد.', ename, q;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists permit_requests_enforce_quota_insert on permit_requests;
create trigger permit_requests_enforce_quota_insert
  before insert on permit_requests
  for each row execute function public.enforce_entity_quota_on_insert();
