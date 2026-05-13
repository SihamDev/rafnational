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
