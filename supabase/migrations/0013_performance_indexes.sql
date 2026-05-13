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
