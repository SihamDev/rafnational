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
