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
