-- ============================================================
-- Migration 0016 — Add follow-up date to leads
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add next_followup_at: when a sales agent should follow up next
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz DEFAULT NULL;

-- Index for dashboard queries (overdue / due today)
CREATE INDEX IF NOT EXISTS idx_leads_followup_at
  ON public.leads (next_followup_at)
  WHERE next_followup_at IS NOT NULL;

-- Allow agents to update this field on their assigned leads
-- (RLS already allows agents to UPDATE their assigned rows,
--  but the trigger restricts certain columns — next_followup_at is new
--  and not restricted, so no trigger change needed)

COMMENT ON COLUMN public.leads.next_followup_at IS
  'Sales agent scheduled follow-up datetime (nullable = no date set)';
