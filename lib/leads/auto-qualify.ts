import type { QualificationStatus } from '@/types/leads'

export type ResolvedQualification = 'qualified' | 'unqualified'

function isYes(value: boolean | string | null | undefined): boolean {
  if (value === true) return true
  if (value === false) return false
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
  return s === 'نعم' || s === 'yes' || s === 'true' || s === '1'
}

/** Rules from ClickFunnels/n8n — salary band, service hold, existing mortgage */
export function autoQualifyFromFields(fields: {
  salary_range_raw?: string | null
  has_existing_mortgage?: boolean | string | null
  has_service_hold?: boolean | string | null
}): ResolvedQualification {
  const salary = String(fields.salary_range_raw ?? '').trim()

  if (salary === '5000-7000' || salary === '8000-10000') return 'unqualified'
  if (isYes(fields.has_service_hold)) return 'unqualified'
  if (isYes(fields.has_existing_mortgage)) return 'unqualified'

  return 'qualified'
}

export function autoQualifyFromFunnelBody(body: Record<string, unknown>): ResolvedQualification {
  return autoQualifyFromFields({
    salary_range_raw: String(body.salary_range_raw ?? body.salary ?? '').trim() || null,
    has_existing_mortgage:
      String(body.has_existing_mortgage ?? body.hasMortgage ?? '').trim() || null,
    has_service_hold: String(body.has_service_hold ?? body.stopServices ?? '').trim() || null,
  })
}

/** Stored status is always qualified/unqualified; legacy `pending` is resolved from form fields */
export function effectiveQualificationStatus(
  stored: QualificationStatus,
  fields: {
    salary_range_raw?: string | null
    has_existing_mortgage?: boolean | string | null
    has_service_hold?: boolean | string | null
  }
): ResolvedQualification {
  if (stored === 'qualified' || stored === 'unqualified') return stored
  return autoQualifyFromFields(fields)
}
