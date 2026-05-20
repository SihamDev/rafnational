-- Backfill legacy pending leads using the same rules as funnel auto-qualify
UPDATE public.leads
SET qualification_status = 'unqualified'
WHERE qualification_status = 'pending'
  AND (
    salary_range_raw IN ('5000-7000', '8000-10000')
    OR has_service_hold IS TRUE
    OR has_existing_mortgage IS TRUE
  );

UPDATE public.leads
SET qualification_status = 'qualified'
WHERE qualification_status = 'pending';

ALTER TABLE public.leads
  ALTER COLUMN qualification_status SET DEFAULT 'qualified';
