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

COMMENT ON COLUMN public.leads.import_source_sheet IS
  'Optional provenance label e.g. sheet1 / qualified / unqualified from Excel import.';
COMMENT ON COLUMN public.leads.import_conflict_notes IS
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
