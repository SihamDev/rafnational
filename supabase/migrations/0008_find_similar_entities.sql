-- Migration 0008: Add find_similar_entities RPC for smart merge suggestions

create or replace function public.find_similar_entities(
  p_entity_id uuid,
  p_limit int default 10
)
returns table(id uuid, name text, sim real, permit_quota int, used bigint, aliases text[], status entity_status)
language sql stable security definer set search_path = public
as $$
  with source as (
    select e.name, e.aliases
    from entities e
    where e.id = p_entity_id
  ),
  candidates as (
    select
      e.id,
      e.name,
      e.permit_quota,
      e.aliases,
      e.status,
      -- Best similarity: max of (name-to-name, name-to-any-alias, any-alias-to-name)
      greatest(
        similarity(lower(e.name), lower(s.name)),
        -- source name vs target aliases
        coalesce((
          select max(similarity(lower(a), lower(s.name)))
          from unnest(e.aliases) a
        ), 0),
        -- source aliases vs target name
        coalesce((
          select max(similarity(lower(sa), lower(e.name)))
          from unnest(s.aliases) sa
        ), 0)
      ) as sim
    from entities e, source s
    where e.id <> p_entity_id
      and e.status <> 'archived'
      and (
        similarity(lower(e.name), lower(s.name)) > 0.2
        or exists(select 1 from unnest(e.aliases) a where similarity(lower(a), lower(s.name)) > 0.2)
        or exists(select 1 from unnest(s.aliases) sa where similarity(lower(sa), lower(e.name)) > 0.2)
      )
  )
  select
    c.id,
    c.name,
    c.sim,
    c.permit_quota,
    coalesce(
      (select count(*) from permit_requests pr where pr.entity_id = c.id and pr.status = 'approved'),
      0
    ) as used,
    c.aliases,
    c.status
  from candidates c
  order by c.sim desc
  limit p_limit;
$$;

grant execute on function public.find_similar_entities(uuid, int) to authenticated;
