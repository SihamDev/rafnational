-- ================================================================
-- راف الوطنية — Full Database Setup
-- Fresh install: run this once in Supabase SQL Editor
-- ================================================================
SET search_path TO public;
-- ================================================================
-- 0001_init.sql
-- ================================================================
-- ============================================================
-- Migration: 0001_init.sql
-- Jarouchi Mall Parking Permit System
-- ============================================================

-- ────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────
create type user_role as enum ('user', 'admin');
create type request_status as enum ('pending', 'approved', 'rejected');
create type mall_floor as enum ('ground', 'first', 'second', 'third', 'mezzanine');

-- ────────────────────────────────────────
-- Profiles (mirrors auth.users 1-1)
-- ────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text,
  phone      text,
  role       user_role not null default 'user',
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- Users read/update their own profile
create policy "profiles: own select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins read all profiles
create policy "profiles: admin select"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ────────────────────────────────────────
-- Permit Requests
-- ────────────────────────────────────────
create table public.permit_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  full_name          text not null,
  phone              text not null,
  email              text not null,
  entity             text not null,
  floor              mall_floor not null,
  office             text not null,
  car_type           text not null,
  plate              text not null,
  id_doc_path        text not null,
  license_doc_path   text not null,
  pledge_doc_path    text not null,
  status             request_status not null default 'pending',
  rejection_reason   text,
  reviewed_by        uuid references auth.users,
  reviewed_at        timestamptz,
  created_at         timestamptz default now() not null,
  updated_at         timestamptz default now() not null
);

alter table public.permit_requests enable row level security;

-- Indexes for performance
create index permit_requests_status_created_at_idx
  on public.permit_requests (status, created_at desc);

create index permit_requests_user_id_idx
  on public.permit_requests (user_id);

-- Users can insert their own requests
create policy "permit_requests: own insert"
  on public.permit_requests for insert
  with check (auth.uid() = user_id);

-- Users can view their own requests
create policy "permit_requests: own select"
  on public.permit_requests for select
  using (auth.uid() = user_id);

-- Admins can view all requests
create policy "permit_requests: admin select"
  on public.permit_requests for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can update requests (approve/reject)
create policy "permit_requests: admin update"
  on public.permit_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ────────────────────────────────────────
-- Trigger: auto-update updated_at
-- ────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger permit_requests_updated_at
  before update on public.permit_requests
  for each row execute function public.handle_updated_at();

-- ────────────────────────────────────────
-- Trigger: auto-create profile on sign-up
-- ────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'user'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ================================================================
-- 0002_storage.sql
-- ================================================================
-- ============================================================
-- Migration: 0002_storage.sql
-- Private bucket for permit documents + RLS policies
-- ============================================================

-- Create the bucket (private = not publicly accessible)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'permit-docs',
  'permit-docs',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Users can upload to their own folder: {user_id}/{request_id}/{doc_type}
create policy "permit-docs: user upload"
  on storage.objects for insert
  with check (
    bucket_id = 'permit-docs'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Users can read their own files
create policy "permit-docs: user read"
  on storage.objects for select
  using (
    bucket_id = 'permit-docs'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Admins can read all files
create policy "permit-docs: admin read"
  on storage.objects for select
  using (
    bucket_id = 'permit-docs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Users can delete their own files
create policy "permit-docs: user delete"
  on storage.objects for delete
  using (
    bucket_id = 'permit-docs'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );


-- ================================================================
-- 0003_fix_rls_recursion.sql
-- ================================================================
-- ============================================================
-- Migration: 0003_fix_rls_recursion.sql
-- Fix infinite recursion in admin RLS policies
-- ============================================================

-- SECURITY DEFINER function bypasses RLS when checking admin role
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Drop the recursive policies
drop policy if exists "profiles: admin select" on public.profiles;
drop policy if exists "permit_requests: admin select" on public.permit_requests;
drop policy if exists "permit_requests: admin update" on public.permit_requests;

-- Recreate using the non-recursive function
create policy "profiles: admin select"
  on public.profiles for select
  using (public.is_admin());

create policy "permit_requests: admin select"
  on public.permit_requests for select
  using (public.is_admin());

create policy "permit_requests: admin update"
  on public.permit_requests for update
  using (public.is_admin());


-- ================================================================
-- 0004_guest_requests.sql
-- ================================================================
-- ============================================================
-- Migration: 0004_guest_requests.sql
-- Enable guest submissions with tracking codes
-- ============================================================

-- 1. Make user_id nullable (guests don't have accounts yet)
alter table public.permit_requests
  alter column user_id drop not null;

-- 2. Add tracking_code column (8-char unique token)
alter table public.permit_requests
  add column if not exists tracking_code text unique;

-- 3. Index on email (case-insensitive) for auto-linking on sign-up
create index if not exists permit_requests_email_lower_idx
  on public.permit_requests (lower(email));

-- 4. Index on tracking_code for fast lookups
create index if not exists permit_requests_tracking_code_idx
  on public.permit_requests (tracking_code);

-- 5. RLS: guests can insert their own rows
create policy "permit_requests: guest insert"
  on public.permit_requests for insert
  with check (user_id is null and tracking_code is not null);

-- 6. RPC: read a single request by tracking code (no auth required, bypasses RLS)
create or replace function public.get_request_by_code(p_code text)
returns setof public.permit_requests
language sql
security definer
stable
set search_path = public
as $$
  select * from public.permit_requests
   where tracking_code = p_code
   limit 1;
$$;

grant execute on function public.get_request_by_code(text) to anon, authenticated;

-- 7. Update the auto-profile trigger to also link guest requests
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'user'
  );

  -- Link any guest requests with the same email to the new account
  update public.permit_requests
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);

  return new;
end;
$$;


-- ================================================================
-- 0005_entities_and_quotas.sql
-- ================================================================
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


-- ================================================================
-- 0006_admin_infrastructure.sql
-- ================================================================
-- ============================================================
-- Migration: 0006_admin_infrastructure.sql
-- activity_log, admin_notifications, app_settings,
-- admin_notes on permit_requests, triggers, RPC
-- ============================================================

-- ────────────────────────────────────────
-- 1. admin_notes column on permit_requests
-- ────────────────────────────────────────
alter table permit_requests
  add column if not exists admin_notes text;

-- ────────────────────────────────────────
-- 2. activity_log
-- ────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users,
  action      text not null,          -- 'approved','rejected','entity_created','entity_updated','quota_changed','user_role_changed'
  entity_type text not null,          -- 'permit_request','entity','user'
  entity_id   text,
  metadata    jsonb default '{}',
  created_at  timestamptz default now() not null
);

create index if not exists activity_log_actor_idx on activity_log (actor_id);
create index if not exists activity_log_action_idx on activity_log (action);
create index if not exists activity_log_created_idx on activity_log (created_at desc);

alter table public.activity_log enable row level security;

create policy "activity_log: admin read"
  on activity_log for select
  using (public.is_admin());

create policy "activity_log: service insert"
  on activity_log for insert
  with check (true);

-- ────────────────────────────────────────
-- 3. admin_notifications
-- ────────────────────────────────────────
create table if not exists public.admin_notifications (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references auth.users,  -- null = broadcast to all admins
  type       text not null,               -- 'new_request','quota_exceeded','new_entity'
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists admin_notif_admin_idx on admin_notifications (admin_id);
create index if not exists admin_notif_read_idx on admin_notifications (read_at) where read_at is null;
create index if not exists admin_notif_created_idx on admin_notifications (created_at desc);

alter table public.admin_notifications enable row level security;

create policy "admin_notif: admin read"
  on admin_notifications for select
  using (public.is_admin() and (admin_id is null or admin_id = auth.uid()));

create policy "admin_notif: admin update"
  on admin_notifications for update
  using (public.is_admin());

create policy "admin_notif: service insert"
  on admin_notifications for insert
  with check (true);

-- Enable realtime
alter publication supabase_realtime add table admin_notifications;

-- ────────────────────────────────────────
-- 4. app_settings
-- ────────────────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_by uuid references auth.users,
  updated_at timestamptz default now() not null
);

alter table public.app_settings enable row level security;

create policy "app_settings: admin read"
  on app_settings for select
  using (public.is_admin());

create policy "app_settings: admin write"
  on app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed default settings
insert into app_settings (key, value) values
  ('email_approval_template', '{"subject":"تم قبول طلب تصريح المواقف","body":"مرحباً {{full_name}}، تمت الموافقة على طلبك."}'),
  ('email_rejection_template', '{"subject":"تحديث حول طلب تصريح المواقف","body":"مرحباً {{full_name}}، تم رفض طلبك للسبب التالي: {{reason}}"}'),
  ('email_tracking_template', '{"subject":"رمز تتبع طلبك","body":"رمز التتبع الخاص بك: {{tracking_code}}"}'),
  ('default_quota', '{"value":5}'),
  ('general', '{"mall_name":"مجمع الجروشي مول","permit_footer":"تصريح صادر عن مجمع الجروشي مول — بإدارة وجهات"}')
on conflict (key) do nothing;

-- ────────────────────────────────────────
-- 5. Trigger: log permit_requests changes
-- ────────────────────────────────────────
create or replace function public.log_permit_request_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- New request submitted
  if tg_op = 'INSERT' then
    insert into activity_log (actor_id, action, entity_type, entity_id, metadata)
      values (new.user_id, 'submitted', 'permit_request', new.id,
              jsonb_build_object('full_name', new.full_name, 'entity_raw', new.entity_raw, 'status', new.status));

    -- Notify all admins
    insert into admin_notifications (type, title, body, link)
      values ('new_request',
              'طلب جديد: ' || new.full_name,
              'تقدّم ' || new.full_name || ' بطلب تصريح من جهة: ' || coalesce(new.entity_raw, '—'),
              '/admin/requests/' || new.id);
    return new;
  end if;

  -- Status changed
  if tg_op = 'UPDATE' and old.status <> new.status then
    insert into activity_log (actor_id, action, entity_type, entity_id, metadata)
      values (new.reviewed_by, new.status, 'permit_request', new.id,
              jsonb_build_object('full_name', new.full_name, 'old_status', old.status,
                                 'rejection_reason', new.rejection_reason));
  end if;

  return new;
end $$;

drop trigger if exists permit_request_audit on permit_requests;
create trigger permit_request_audit
  after insert or update on permit_requests
  for each row execute function public.log_permit_request_changes();

-- ────────────────────────────────────────
-- 6. Trigger: log entity changes
-- ────────────────────────────────────────
create or replace function public.log_entity_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_log (actor_id, action, entity_type, entity_id, metadata)
      values (new.created_by, 'entity_created', 'entity', new.id,
              jsonb_build_object('name', new.name, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    if old.status <> new.status then
      insert into activity_log (actor_id, action, entity_type, entity_id, metadata)
        values (auth.uid(), 'entity_status_changed', 'entity', new.id,
                jsonb_build_object('name', new.name, 'old_status', old.status, 'new_status', new.status));
    end if;
    if old.permit_quota <> new.permit_quota then
      insert into activity_log (actor_id, action, entity_type, entity_id, metadata)
        values (auth.uid(), 'quota_changed', 'entity', new.id,
                jsonb_build_object('name', new.name, 'old_quota', old.permit_quota, 'new_quota', new.permit_quota));
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists entity_audit on entities;
create trigger entity_audit
  after insert or update on entities
  for each row execute function public.log_entity_changes();

-- ────────────────────────────────────────
-- 7. RPC: admin_dashboard_stats
-- ────────────────────────────────────────
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
  total_requests int;
  pending_requests int;
  approved_requests int;
  rejected_requests int;
  this_month_requests int;
  approval_rate numeric;
  requests_by_day jsonb;
  requests_by_floor jsonb;
  top_entities jsonb;
begin
  select count(*) into total_requests from permit_requests;
  select count(*) into pending_requests from permit_requests where status = 'pending';
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

  -- Top 10 entities by used permits
  select jsonb_agg(row_to_json(e)) into top_entities
    from (
      select coalesce(en.name, pr.entity_raw, '—') as label,
             count(*) filter (where pr.status = 'approved') as value
        from permit_requests pr
        left join entities en on en.id = pr.entity_id
       group by label
       order by value desc
       limit 10
    ) e;

  result := jsonb_build_object(
    'total', total_requests,
    'pending', pending_requests,
    'approved', approved_requests,
    'rejected', rejected_requests,
    'this_month', this_month_requests,
    'approval_rate', approval_rate,
    'by_day', coalesce(requests_by_day, '[]'::jsonb),
    'by_floor', coalesce(requests_by_floor, '[]'::jsonb),
    'top_entities', coalesce(top_entities, '[]'::jsonb)
  );

  return result;
end $$;

grant execute on function public.admin_dashboard_stats() to authenticated;

-- ────────────────────────────────────────
-- 8. RPC: get_users_with_request_count
-- ────────────────────────────────────────
create or replace function public.get_users_with_request_count()
returns table(
  id uuid, full_name text, phone text, role text,
  email text, created_at timestamptz, request_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    p.id, p.full_name, p.phone, p.role::text,
    u.email, p.created_at,
    count(pr.id) as request_count
  from profiles p
  join auth.users u on u.id = p.id
  left join permit_requests pr on pr.user_id = p.id
  group by p.id, p.full_name, p.phone, p.role, u.email, p.created_at
  order by p.created_at desc;
$$;

grant execute on function public.get_users_with_request_count() to authenticated;


-- ================================================================
-- 0007_requests_realtime.sql
-- ================================================================
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


-- ================================================================
-- 0008_find_similar_entities.sql
-- ================================================================
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


-- ================================================================
-- 0010_quota_reserve_pending.sql
-- ================================================================
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


-- ================================================================
-- 0011_permit_requests_delete_policy.sql
-- ================================================================
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


-- ================================================================
-- 0012_permit_number.sql
-- ================================================================
-- ============================================================
-- Migration 0012: permit_number column
-- رقم التصريح يُعيَّن يدوياً من قِبَل المدير بعد الموافقة
-- ============================================================

alter table public.permit_requests
  add column if not exists permit_number text;

-- index for quick lookups / uniqueness checks
create index if not exists permit_requests_permit_number_idx
  on public.permit_requests (permit_number)
  where permit_number is not null;


-- ================================================================
-- 0013_performance_indexes.sql
-- ================================================================
-- ============================================================
-- Migration: 0013_performance_indexes.sql
-- Performance improvements: remove redundant index, add missing
-- composite and FK indexes on permit_requests.
-- ============================================================

-- ────────────────────────────────────────
-- 1. Drop redundant duplicate index
--    permit_requests_status_created_idx (0007) is identical to
--    permit_requests_status_created_at_idx (0001): both index
--    (status, created_at desc). Keeping the original from 0001.
-- ────────────────────────────────────────
drop index if exists public.permit_requests_status_created_idx;

-- ────────────────────────────────────────
-- 2. Composite index for quota enforcement
--    The enforce_entity_quota trigger runs:
--      count(*) where entity_id = X and status in ('approved','pending')
--    A composite (entity_id, status) index makes this O(log n)
--    instead of a filter scan on the single entity_id index.
-- ────────────────────────────────────────
create index if not exists permit_requests_entity_status_idx
  on public.permit_requests (entity_id, status)
  where entity_id is not null;

-- ────────────────────────────────────────
-- 3. Index on reviewed_by FK
--    This column is a foreign key to auth.users but has no index.
--    Useful for admin queries filtering by reviewer.
-- ────────────────────────────────────────
create index if not exists permit_requests_reviewed_by_idx
  on public.permit_requests (reviewed_by)
  where reviewed_by is not null;


-- ================================================================
-- 0014_leads_crm_schema.sql
-- ================================================================
-- ============================================================
-- CRM leads (Raf National / funnel) — schema
-- Depends on profiles + is_admin(); extends user_role
-- ============================================================

-- ── Role: sales_agent (extend enum safely inside transactional migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'user_role'
       AND e.enumlabel = 'sales_agent'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'sales_agent';
  END IF;
END $$;
CREATE TYPE qualification_status AS ENUM (
  'pending',
  'qualified',
  'unqualified'
);

CREATE TYPE sales_workflow_status AS ENUM (
  'new',
  'contacted',
  'follow_up',
  'no_answer',
  'interested',
  'not_interested',
  'converted'
);

-- ── Helper: CRM staff flag (cached check used in RPCs)
CREATE OR REPLACE FUNCTION public.is_sales_agent()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'sales_agent'::user_role
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_sales_agent() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_crm_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.is_admin(), FALSE) OR COALESCE(public.is_sales_agent(), FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.is_crm_staff() TO authenticated;

-- ── Normalize phone loosely for matching/dedupe (best-effort, KSA-ish)
CREATE OR REPLACE FUNCTION public.normalize_lead_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
  t text := trim(p);
BEGIN
  IF p IS NULL OR t IN ('', '-', 'x') THEN RETURN NULL; END IF;

  -- Scientific notation from Excel/other exports ("9.66E+11")
  IF t ~* 'e[+-]?\d' THEN
    BEGIN
      s := (floor((t)::double precision))::bigint::text;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  ELSE
    s := regexp_replace(lower(t), '[^0-9+]', '', 'g');
  END IF;

  IF s IS NULL OR s IN ('', '0') THEN RETURN NULL; END IF;

  IF s LIKE '966%' THEN
    RETURN s;
  END IF;

  IF length(s) = 9 AND s LIKE '5%' THEN
    RETURN '966' || s;
  END IF;

  IF length(s) = 10 AND s LIKE '05%' THEN
    RETURN '966' || substring(s from 2);
  END IF;

  IF length(s) = 12 AND s LIKE '9665%' THEN
    RETURN s;
  END IF;

  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.leads_set_normalized_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.phone_normalized := normalize_lead_phone(NEW.phone_number);
  RETURN NEW;
END $$;

CREATE TABLE public.leads (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  first_name                 text NOT NULL,
  family_name                text,
  phone_number               text,
  phone_normalized           text,
  email                      text,

  city                       text,

  has_existing_mortgage      boolean,
  bank_name                  text,

  salary_range_raw           text,
  housing_support_raw        text,
  employer_raw               text,

  requested_amount_raw       text,

  has_service_hold           boolean,
  financing_need_raw         text,

  visit_source_raw           text,
  campaign_raw               text,

  funnel_submitted_at        timestamptz,

  qualification_status       qualification_status NOT NULL DEFAULT 'pending',
  sales_workflow_status      sales_workflow_status NOT NULL DEFAULT 'new',

  assigned_to                uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  internal_notes             text,

  import_source_sheet        text,
  import_conflict_notes      text,
  merged_from_qualified_row  integer,
  merged_from_unqualified_row integer,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS leads_set_normalized_phone_trg ON public.leads;

CREATE TRIGGER leads_set_normalized_phone_trg
  BEFORE INSERT OR UPDATE OF phone_number ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_set_normalized_phone();

COMMENT ON COLUMN public.import_source_sheet IS
  'Optional provenance label e.g. sheet1 / qualified / unqualified from Excel import.';
COMMENT ON COLUMN public.import_conflict_notes IS
  'Append-only reconciliation notes — never blindly overwrite originals.';

CREATE INDEX leads_created_at_desc_idx ON public.leads (created_at DESC);

CREATE INDEX leads_phone_normalized_idx ON public.leads (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE INDEX leads_email_lower_idx ON public.leads (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX leads_qual_sales_idx ON public.leads (
  qualification_status,
  sales_workflow_status,
  created_at DESC
);

CREATE INDEX leads_assigned_to_idx ON public.leads (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Agents cannot escalate qualification or change assignment / identity funnel fields via API.
CREATE OR REPLACE FUNCTION public.enforce_agent_lead_update_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent boolean;
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.id = auth.uid()
             AND p.role = 'sales_agent'::user_role
         )
  INTO agent;

  IF COALESCE(public.is_admin(), FALSE) THEN
    RETURN NEW;
  END IF;

  IF agent AND OLD.assigned_to IS NOT DISTINCT FROM auth.uid() THEN
    IF NEW.qualification_status IS DISTINCT FROM OLD.qualification_status THEN
      RAISE EXCEPTION 'Sales agents cannot change qualification_status';
    END IF;

    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      RAISE EXCEPTION 'Sales agents cannot change assignment';
    END IF;

    IF NEW.phone_number IS DISTINCT FROM OLD.phone_number
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Sales agents cannot change contact identifiers';
    END IF;

    IF NEW.first_name IS DISTINCT FROM OLD.first_name
       OR NEW.family_name IS DISTINCT FROM OLD.family_name THEN
      RAISE EXCEPTION 'Sales agents cannot change name fields';
    END IF;

    IF NEW.visit_source_raw IS DISTINCT FROM OLD.visit_source_raw
       OR NEW.campaign_raw IS DISTINCT FROM OLD.campaign_raw
       OR NEW.funnel_submitted_at IS DISTINCT FROM OLD.funnel_submitted_at THEN
      RAISE EXCEPTION 'Sales agents cannot change marketing attribution';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_agent_lead_updates ON public.leads;
CREATE TRIGGER enforce_agent_lead_updates
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_lead_update_policy();

-- ── Aggregate stats helper (counts respect staff role in SQL)
CREATE OR REPLACE FUNCTION public.crm_leads_dashboard_stats(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 1));
BEGIN
  IF NOT COALESCE(public.is_crm_staff(), FALSE) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF public.is_admin() THEN
    RETURN jsonb_build_object(
      'total', (SELECT count(*) FROM public.leads),
      'in_window',
        (SELECT count(*) FROM public.leads l WHERE l.created_at >= cutoff),
      'by_qualification',
        (SELECT coalesce(jsonb_object_agg(q, c), '{}'::jsonb)
           FROM (
             SELECT qualification_status::text AS q, count(*) AS c FROM public.leads GROUP BY 1
           ) s),
      'by_sales',
        (SELECT coalesce(jsonb_object_agg(s, c), '{}'::jsonb)
           FROM (
             SELECT sales_workflow_status::text AS s, count(*) AS c FROM public.leads GROUP BY 1
           ) ss),
      'by_source',
        (
          SELECT coalesce(
                   jsonb_agg(jsonb_build_object('label', d.label, 'value', d.c)),
                   '[]'::jsonb
                 )
            FROM (
              SELECT coalesce(trim(visit_source_raw), '—') AS label,
                     count(*) AS c
                FROM public.leads l5
               WHERE trim(coalesce(l5.visit_source_raw, '')) <> ''
               GROUP BY 1
               ORDER BY c DESC NULLS LAST
               LIMIT 12
            ) d
        )
    );
  ELSE
    RETURN jsonb_build_object(
      'total',
        (
          SELECT count(*) FROM public.leads l WHERE l.assigned_to IS NOT DISTINCT FROM auth.uid()
        ),
      'in_window',
        (
          SELECT count(*)
            FROM public.leads l
           WHERE l.assigned_to IS NOT DISTINCT FROM auth.uid()
             AND l.created_at >= cutoff
        ),
      'by_qualification',
        (
          SELECT coalesce(jsonb_object_agg(q, c), '{}'::jsonb)
            FROM (
              SELECT qualification_status::text AS q, count(*) AS c
                FROM public.leads l2
               WHERE assigned_to IS NOT DISTINCT FROM auth.uid()
               GROUP BY 1
            ) s
        ),
      'by_sales',
        (
          SELECT coalesce(jsonb_object_agg(ss, cc), '{}'::jsonb)
            FROM (
              SELECT sales_workflow_status::text AS ss, count(*) AS cc
                FROM public.leads l3
               WHERE assigned_to IS NOT DISTINCT FROM auth.uid()
               GROUP BY 1
            ) g
        ),
      'by_source',
        (
          SELECT coalesce(
                   jsonb_agg(jsonb_build_object('label', d.label, 'value', d.c)),
                   '[]'::jsonb
                 )
            FROM (
              SELECT coalesce(trim(visit_source_raw), '—') AS label, count(*) AS c
                FROM public.leads l5
               WHERE assigned_to IS NOT DISTINCT FROM auth.uid()
                 AND trim(coalesce(l5.visit_source_raw, '')) <> ''
               GROUP BY 1
               ORDER BY c DESC NULLS LAST
               LIMIT 12
            ) d
        )
    );
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.crm_leads_dashboard_stats(integer) TO authenticated;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_admin_select_all"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "leads_agent_select_own"
  ON public.leads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'sales_agent'::user_role
    )
    AND assigned_to IS NOT DISTINCT FROM auth.uid()
  );

CREATE POLICY "leads_admin_insert"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "leads_admin_update"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "leads_admin_delete"
  ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "leads_agent_update_own"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'sales_agent'::user_role
    )
    AND assigned_to IS NOT DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'sales_agent'::user_role
    )
    AND assigned_to IS NOT DISTINCT FROM auth.uid()
  );


