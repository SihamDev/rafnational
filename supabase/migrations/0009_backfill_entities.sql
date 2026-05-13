-- ============================================================
-- Migration: 0009_backfill_entities.sql
-- Backfill entities from existing permit_requests.entity_raw
-- and link requests to entities. Safe to run multiple times.
-- ============================================================

-- Helper: normalize entity name (trim + collapse internal whitespace)
create or replace function public._normalize_entity_name(p text)
returns text language sql immutable as $$
  select nullif(regexp_replace(trim(p), '\s+', ' ', 'g'), '')
$$;

-- ────────────────────────────────────────────────────────────
-- Step 1: Create entities for every distinct entity_raw that
--         does not yet exist in the entities table.
-- ────────────────────────────────────────────────────────────
with distinct_names as (
  select distinct _normalize_entity_name(entity_raw) as name
  from permit_requests
  where entity_raw is not null
    and _normalize_entity_name(entity_raw) is not null
)
insert into entities (name, status, permit_quota)
select d.name, 'pending_review'::entity_status, 5
from distinct_names d
on conflict (lower(name)) do nothing;

-- ────────────────────────────────────────────────────────────
-- Step 2: Link permit_requests.entity_id to the matching
--         entity (case-insensitive match on normalized name).
-- ────────────────────────────────────────────────────────────
update permit_requests pr
   set entity_id = e.id
  from entities e
 where pr.entity_id is null
   and pr.entity_raw is not null
   and lower(e.name) = lower(_normalize_entity_name(pr.entity_raw));

-- ────────────────────────────────────────────────────────────
-- Step 3: Merge near-duplicate entities that were created
--         from slightly different spellings (high similarity).
--         Keeps the oldest entity, moves requests + aliases,
--         archives the duplicate.
-- ────────────────────────────────────────────────────────────
do $$
declare
  r record;
  keeper_id uuid;
  dup_id uuid;
begin
  -- Find pairs with similarity > 0.75 where both are pending_review
  for r in
    with pairs as (
      select
        least(a.id, b.id) as id_a,
        greatest(a.id, b.id) as id_b,
        a.created_at as a_created,
        b.created_at as b_created,
        a.id as raw_a,
        b.id as raw_b,
        similarity(lower(a.name), lower(b.name)) as sim
      from entities a
      join entities b
        on a.id < b.id
       and a.status = 'pending_review'
       and b.status = 'pending_review'
       and similarity(lower(a.name), lower(b.name)) > 0.85
    )
    select * from pairs
    order by sim desc
  loop
    -- Determine keeper (oldest) and duplicate
    if r.a_created <= r.b_created then
      keeper_id := r.raw_a;
      dup_id := r.raw_b;
    else
      keeper_id := r.raw_b;
      dup_id := r.raw_a;
    end if;

    -- Skip if either was already merged away
    if not exists (select 1 from entities where id = keeper_id)
       or not exists (select 1 from entities where id = dup_id) then
      continue;
    end if;

    -- Move requests from duplicate to keeper
    update permit_requests set entity_id = keeper_id where entity_id = dup_id;

    -- Merge the duplicate's name into keeper's aliases
    update entities
       set aliases = (
         select array(select distinct unnest(aliases || array[name]))
         from entities where id = dup_id
       ) || aliases
     where id = keeper_id;

    -- Delete the duplicate
    delete from entities where id = dup_id;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────
-- Cleanup helper
-- ────────────────────────────────────────────────────────────
drop function if exists public._normalize_entity_name(text);
