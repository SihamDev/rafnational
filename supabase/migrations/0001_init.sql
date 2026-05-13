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
