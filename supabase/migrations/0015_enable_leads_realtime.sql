-- ============================================================
-- Migration 0015 — Enable Realtime on leads table
-- Run in: Supabase Dashboard → SQL Editor
-- Purpose: Allows client subscriptions to INSERT/UPDATE/DELETE
--          on the leads table for live dashboard notifications.
-- ============================================================

-- Add the leads table to the default supabase_realtime publication.
-- This is idempotent — safe to re-run.
DO $$
BEGIN
  -- Only add if not already a member of the publication
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END;
$$;

-- Grant SELECT on leads to the authenticated role so RLS-filtered
-- realtime events can be delivered to logged-in users.
GRANT SELECT ON public.leads TO authenticated;

-- Verify (optional — returns one row if enabled)
-- SELECT schemaname, tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename = 'leads';
