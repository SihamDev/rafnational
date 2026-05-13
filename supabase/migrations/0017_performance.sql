-- ============================================================
-- Migration 0017 — Performance: text indexes + admin dashboard RPC
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Fast text search via pg_trgm ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for ilike search on name + phone + city
CREATE INDEX IF NOT EXISTS idx_leads_trgm_first_name
  ON public.leads USING GIN (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_trgm_family_name
  ON public.leads USING GIN (family_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_trgm_phone
  ON public.leads USING GIN (phone_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_trgm_city
  ON public.leads USING GIN (city gin_trgm_ops);

-- Partial index for quick "today" count
CREATE INDEX IF NOT EXISTS idx_leads_created_at_brin
  ON public.leads USING BRIN (created_at);

-- ── 2. Single-call admin dashboard RPC ─────────────────────────────────
-- Returns everything the admin dashboard needs in ONE round-trip:
--   total, today_count, qualified, pending, unqualified,
--   by_sales, by_source, by_city, recent_leads, trend_30d
CREATE OR REPLACE FUNCTION public.crm_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today  timestamptz := date_trunc('day', now());
  v_ago30  timestamptz := now() - interval '30 days';
BEGIN
  IF NOT COALESCE(public.is_admin(), FALSE) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN jsonb_build_object(
    -- ── Headline KPIs ──
    'total',         (SELECT count(*) FROM public.leads),
    'today_count',   (SELECT count(*) FROM public.leads WHERE created_at >= v_today),
    'qualified',     (SELECT count(*) FROM public.leads WHERE qualification_status = 'qualified'),
    'pending',       (SELECT count(*) FROM public.leads WHERE qualification_status = 'pending'),
    'unqualified',   (SELECT count(*) FROM public.leads WHERE qualification_status = 'unqualified'),

    -- ── Sales pipeline ──
    'by_sales',
      (SELECT coalesce(jsonb_object_agg(s, c), '{}'::jsonb)
         FROM (
           SELECT sales_workflow_status::text AS s, count(*) AS c
             FROM public.leads GROUP BY 1
         ) x),

    -- ── Source breakdown (top 8) ──
    'by_source',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', c)), '[]'::jsonb)
         FROM (
           SELECT coalesce(nullif(trim(visit_source_raw), ''), '—') AS label,
                  count(*) AS c
             FROM public.leads
            WHERE trim(coalesce(visit_source_raw, '')) <> ''
            GROUP BY 1
            ORDER BY c DESC
            LIMIT 8
         ) src),

    -- ── City breakdown (top 8) ──
    'by_city',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', c)), '[]'::jsonb)
         FROM (
           SELECT coalesce(nullif(trim(city), ''), 'غير محدد') AS label,
                  count(*) AS c
             FROM public.leads
            GROUP BY 1
            ORDER BY c DESC
            LIMIT 8
         ) cty),

    -- ── 30-day daily trend ──
    'trend_30d',
      (SELECT coalesce(jsonb_agg(jsonb_build_object(
           'label',    to_char(day, 'YYYY-MM-DD'),
           'pending',  total,
           'approved', qualified,
           'rejected', unqualified
         ) ORDER BY day), '[]'::jsonb)
       FROM (
         SELECT created_at::date AS day,
                count(*)                                                        AS total,
                count(*) FILTER (WHERE qualification_status = 'qualified')      AS qualified,
                count(*) FILTER (WHERE qualification_status = 'unqualified')    AS unqualified
           FROM public.leads
          WHERE created_at >= v_ago30
          GROUP BY 1
       ) t),

    -- ── Last 6 leads ──
    'recent_leads',
      (SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id',                   id,
           'first_name',           first_name,
           'family_name',          family_name,
           'phone_number',         phone_number,
           'city',                 city,
           'qualification_status', qualification_status,
           'visit_source_raw',     visit_source_raw,
           'created_at',           created_at
         ) ORDER BY created_at DESC), '[]'::jsonb)
       FROM (
         SELECT id, first_name, family_name, phone_number, city,
                qualification_status, visit_source_raw, created_at
           FROM public.leads
          ORDER BY created_at DESC
          LIMIT 6
       ) r)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.crm_admin_dashboard() TO authenticated;
