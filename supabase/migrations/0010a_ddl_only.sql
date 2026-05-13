-- ============================================================
-- Migration 0010 — DDL Only (safe to run in SQL Editor)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Update entity_quota_stats view
--    used = approved + pending (both consume quota)
-- ============================================================
-- Must drop first because column names changed
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
  coalesce(sum(case when r.status in ('approved','pending') then 1 else 0 end), 0)::int as used,
  greatest(
    e.permit_quota
      - coalesce(sum(case when r.status in ('approved','pending') then 1 else 0 end), 0),
    0
  )::int as remaining
from entities e
left join permit_requests r on r.entity_id = e.id
group by e.id;

-- 2. Raise quotas for entities where pending+approved > current quota
-- ============================================================
update entities e
   set permit_quota = greatest(
         e.permit_quota,
         ceil(
           coalesce((
             select count(*) from permit_requests r
              where r.entity_id = e.id and r.status in ('pending','approved')
           ), 0) * 1.2
         )::int,
         5
       );

-- 3. get_entity_quota RPC — returns new fields
-- ============================================================
drop function if exists public.get_entity_quota(uuid);
create function public.get_entity_quota(p_entity_id uuid)
returns table(
  used           int,
  remaining      int,
  permit_quota   int,
  entity_name    text,
  approved_count int,
  pending_count  int,
  rejected_count int,
  is_exhausted   boolean
)
language sql stable security definer
set search_path = public
as $$
  select
    used, remaining, permit_quota,
    name as entity_name,
    approved_count, pending_count, rejected_count,
    (remaining = 0) as is_exhausted
  from entity_quota_stats
  where id = p_entity_id;
$$;

grant execute on function public.get_entity_quota(uuid) to authenticated;
grant execute on function public.get_entity_quota(uuid) to anon;

-- 4. search_entities RPC — returns quota availability
-- ============================================================
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
    s.id, s.name, s.status, s.permit_quota,
    s.used, s.remaining, (s.remaining = 0) as is_exhausted
  from entity_quota_stats s
  where s.status = 'active'
    and (
      s.name ilike '%' || q || '%'
      or exists (select 1 from unnest(s.aliases) a where a ilike '%' || q || '%')
    )
  order by similarity(s.name, q) desc, s.name
  limit 10;
$$;

grant execute on function public.search_entities(text) to anon, authenticated;

-- 5. enforce_entity_quota (UPDATE trigger)
--    Fires when status changes from non-consuming to consuming
-- ============================================================
create or replace function public.enforce_entity_quota()
returns trigger language plpgsql as $$
declare
  q        int;
  used_cnt int;
  ename    text;
  estatus  entity_status;
begin
  if new.status in ('approved', 'pending')
     and (old.status is null or old.status not in ('approved', 'pending'))
     and new.entity_id is not null
  then
    select e.permit_quota, e.name, e.status
      into q, ename, estatus
      from entities e where e.id = new.entity_id;

    if estatus = 'pending_review' then return new; end if;

    select count(*) into used_cnt
      from permit_requests
     where entity_id = new.entity_id
       and status in ('approved', 'pending')
       and id <> new.id;

    if used_cnt >= q then
      raise exception 'تجاوزت الجهة "%" الحد المسموح (% تصاريح).', ename, q;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists permit_requests_enforce_quota on permit_requests;
create trigger permit_requests_enforce_quota
  before update on permit_requests
  for each row execute function public.enforce_entity_quota();

-- 6. enforce_entity_quota_on_insert (INSERT trigger)
--    Blocks submission when entity quota is exhausted
-- ============================================================
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
      from entities e where e.id = new.entity_id;

    if estatus = 'pending_review' then return new; end if;

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

-- ============================================================
-- Verification
-- ============================================================
select
  name,
  permit_quota,
  approved_count,
  pending_count,
  used,
  remaining,
  (remaining = 0) as is_exhausted
from entity_quota_stats
order by used desc
limit 15;

-- 7. Fix admin_dashboard_stats: top_entities now counts pending+approved
-- ============================================================
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result               jsonb;
  total_requests       int;
  pending_requests     int;
  approved_requests    int;
  rejected_requests    int;
  this_month_requests  int;
  approval_rate        numeric;
  requests_by_day      jsonb;
  requests_by_floor    jsonb;
  top_entities         jsonb;
begin
  select count(*) into total_requests   from permit_requests;
  select count(*) into pending_requests  from permit_requests where status = 'pending';
  select count(*) into approved_requests from permit_requests where status = 'approved';
  select count(*) into rejected_requests from permit_requests where status = 'rejected';

  select count(*) into this_month_requests
    from permit_requests
   where created_at >= date_trunc('month', now());

  approval_rate := case when (approved_requests + rejected_requests) > 0
    then round(approved_requests::numeric / (approved_requests + rejected_requests) * 100, 1)
    else 0 end;

  -- Last 30 days by day
  select jsonb_agg(row_to_json(d)) into requests_by_day
    from (
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*) filter (where status = 'pending')  as pending,
             count(*) filter (where status = 'approved') as approved,
             count(*) filter (where status = 'rejected') as rejected
        from permit_requests
       where created_at >= now() - interval '30 days'
       group by day order by day
    ) d;

  -- By floor
  select jsonb_agg(row_to_json(f)) into requests_by_floor
    from (
      select floor as label, count(*) as value
        from permit_requests
       group by floor order by value desc
    ) f;

  -- Top 10 entities by used quota (approved + pending)
  select jsonb_agg(row_to_json(e)) into top_entities
    from (
      select coalesce(en.name, pr.entity_raw, '—') as label,
             -- count approved + pending (both consume quota)
             count(*) filter (where pr.status in ('approved','pending')) as value
        from permit_requests pr
        left join entities en on en.id = pr.entity_id
       group by label
       order by value desc
       limit 10
    ) e;

  result := jsonb_build_object(
    'total',         total_requests,
    'pending',       pending_requests,
    'approved',      approved_requests,
    'rejected',      rejected_requests,
    'this_month',    this_month_requests,
    'approval_rate', approval_rate,
    'by_day',        coalesce(requests_by_day,  '[]'::jsonb),
    'by_floor',      coalesce(requests_by_floor,'[]'::jsonb),
    'top_entities',  coalesce(top_entities,     '[]'::jsonb)
  );

  return result;
end $$;

grant execute on function public.admin_dashboard_stats() to authenticated;