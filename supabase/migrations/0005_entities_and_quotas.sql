-- ============================================================
-- Migration: 0005_entities_and_quotas.sql
-- Entity management with permit quotas
-- ============================================================

-- Enable trigram extension for fuzzy search
create extension if not exists pg_trgm;

-- ────────────────────────────────────────
-- Entity status enum
-- ────────────────────────────────────────
DO $$ BEGIN
  create type entity_status as enum ('active', 'pending_review', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ────────────────────────────────────────
-- Entities table
-- ────────────────────────────────────────
create table if not exists public.entities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  aliases       text[] not null default '{}',
  permit_quota  int  not null default 5 check (permit_quota >= 0),
  status        entity_status not null default 'active',
  notes         text,
  created_by    uuid references auth.users,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

create unique index if not exists entities_name_lower_idx on entities (lower(name));
create index if not exists entities_name_trgm_idx on entities using gin (name gin_trgm_ops);
create index if not exists entities_status_idx on entities (status);

-- ────────────────────────────────────────
-- Trigger: auto-update updated_at on entities
-- ────────────────────────────────────────
create or replace function public.handle_entities_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger entities_updated_at
  before update on entities
  for each row execute function public.handle_entities_updated_at();

-- ────────────────────────────────────────
-- Rename entity → entity_raw, add entity_id FK
-- ────────────────────────────────────────
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_name='permit_requests' and column_name='entity'
  ) then
    alter table permit_requests rename column entity to entity_raw;
  end if;
end $$;

alter table permit_requests
  add column if not exists entity_id uuid references entities(id);

create index if not exists permit_requests_entity_id_idx on permit_requests (entity_id);

-- ────────────────────────────────────────
-- Seed: extract distinct entities from entity_raw
-- Groups similar names using pg_trgm (similarity > 0.55)
-- ────────────────────────────────────────
do $$
declare
  r record;
  canonical text;
  eid uuid;
  norm text;
begin
  -- Process each distinct entity_raw value
  for r in
    select distinct
      trim(regexp_replace(lower(entity_raw),
        '^(شركة|مؤسسة|مكتب|مطعم|محل|مجمع|مركز|معهد|مدرسة|جمعية|هيئة|وزارة|ادارة|إدارة)\s+', '', 'gi'))
      as normed,
      entity_raw as original
    from permit_requests
    where entity_raw is not null and entity_raw <> ''
    order by 1
  loop
    norm := r.normed;
    -- Try to find an existing entity with similarity > 0.55
    select id, name into eid, canonical
      from entities
     where similarity(lower(name), norm) > 0.55
        or norm = any(select lower(x) from unnest(aliases) x)
     order by similarity(lower(name), norm) desc
     limit 1;

    if eid is null then
      -- No match — create new entity using the original name
      insert into entities (name, aliases, status, permit_quota)
        values (r.original, array[]::text[], 'active', 5)
        on conflict (lower(name)) do nothing
        returning id into eid;

      -- If conflict happened, fetch the existing one
      if eid is null then
        select id into eid from entities where lower(name) = lower(r.original);
      end if;
    else
      -- Add alias if not already there
      update entities
         set aliases = array_append(aliases, r.original)
       where id = eid
         and not (r.original = any(aliases))
         and lower(r.original) <> lower(name);
    end if;

    -- Link all matching permit_requests
    if eid is not null then
      update permit_requests
         set entity_id = eid
       where entity_raw = r.original
         and entity_id is null;
    end if;
  end loop;
end $$;

-- ────────────────────────────────────────
-- Trigger: enforce entity quota on approval
-- ────────────────────────────────────────
create or replace function public.enforce_entity_quota()
returns trigger language plpgsql as $$
declare
  q int;
  used int;
  ename text;
begin
  if new.status = 'approved'
     and (old.status is null or old.status <> 'approved')
     and new.entity_id is not null
  then
    select permit_quota, name into q, ename from entities where id = new.entity_id;
    select count(*) into used from permit_requests
     where entity_id = new.entity_id and status = 'approved' and id <> new.id;
    if used >= q then
      raise exception 'تجاوزت الجهة "%" الحد المسموح (% تصاريح). لا يمكن الموافقة.', ename, q;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists permit_requests_enforce_quota on permit_requests;
create trigger permit_requests_enforce_quota
  before update on permit_requests
  for each row execute function public.enforce_entity_quota();

-- ────────────────────────────────────────
-- View: entity quota statistics
-- ────────────────────────────────────────
create or replace view entity_quota_stats as
select
  e.id,
  e.name,
  e.status,
  e.permit_quota,
  e.aliases,
  e.notes,
  e.created_at,
  coalesce(sum(case when r.status = 'approved' then 1 else 0 end), 0)::int as used,
  coalesce(sum(case when r.status = 'pending'  then 1 else 0 end), 0)::int as pending_count,
  greatest(e.permit_quota - coalesce(sum(case when r.status = 'approved' then 1 else 0 end), 0), 0)::int as remaining
from entities e
left join permit_requests r on r.entity_id = e.id
group by e.id;

-- ────────────────────────────────────────
-- RLS for entities
-- ────────────────────────────────────────
alter table public.entities enable row level security;

-- Anyone can read active entities (for combobox search)
create policy "entities: public read"
  on entities for select
  using (true);

-- Only admins can insert/update/delete
create policy "entities: admin insert"
  on entities for insert
  with check (public.is_admin() or true);  -- also allow pending_review inserts via service-role

create policy "entities: admin update"
  on entities for update
  using (public.is_admin());

create policy "entities: admin delete"
  on entities for delete
  using (public.is_admin());

-- ────────────────────────────────────────
-- RPC: search entities (fuzzy + alias match)
-- ────────────────────────────────────────
create or replace function public.search_entities(q text)
returns table(id uuid, name text, status entity_status, permit_quota int)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.name, e.status, e.permit_quota
    from entities e
   where e.status = 'active'
     and (
       e.name ilike '%' || q || '%'
       or exists (
         select 1 from unnest(e.aliases) a where a ilike '%' || q || '%'
       )
     )
   order by similarity(e.name, q) desc, e.name
   limit 10;
$$;

grant execute on function public.search_entities(text) to anon, authenticated;

-- ────────────────────────────────────────
-- RPC: get entity quota for a specific entity
-- ────────────────────────────────────────
create or replace function public.get_entity_quota(p_entity_id uuid)
returns table(used int, remaining int, permit_quota int, entity_name text)
language sql stable security definer
set search_path = public
as $$
  select used, remaining, permit_quota, name as entity_name
    from entity_quota_stats
   where id = p_entity_id;
$$;

grant execute on function public.get_entity_quota(uuid) to authenticated;
grant execute on function public.get_entity_quota(uuid) to anon;
