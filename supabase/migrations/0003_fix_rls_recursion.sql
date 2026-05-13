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
