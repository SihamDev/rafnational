/** CRM lead enums — Postgres mirrors these labels (english snake-case in DB only) */

export type StaffRole = 'admin' | 'sales_agent'

export type QualificationStatus = 'pending' | 'qualified' | 'unqualified'

export type SalesWorkflowStatus =
  | 'new'
  | 'contacted'
  | 'follow_up'
  | 'no_answer'
  | 'interested'
  | 'not_interested'
  | 'converted'

export interface LeadRow {
  id: string
  first_name: string
  family_name: string | null
  phone_number: string | null
  phone_normalized: string | null
  email: string | null
  city: string | null
  has_existing_mortgage: boolean | null
  bank_name: string | null
  salary_range_raw: string | null
  housing_support_raw: string | null
  employer_raw: string | null
  requested_amount_raw: string | null
  has_service_hold: boolean | null
  financing_need_raw: string | null
  visit_source_raw: string | null
  campaign_raw: string | null
  funnel_submitted_at: string | null
  qualification_status: QualificationStatus
  sales_workflow_status: SalesWorkflowStatus
  assigned_to: string | null
  internal_notes: string | null
  import_source_sheet: string | null
  import_conflict_notes: string | null
  merged_from_qualified_row: number | null
  merged_from_unqualified_row: number | null
  next_followup_at: string | null
  created_at: string
  updated_at: string
}

export const QUALIFICATION_LABELS: Record<QualificationStatus, string> = {
  pending: 'غير مؤهل',
  qualified: 'مؤهل',
  unqualified: 'غير مؤهل',
}

/** UI / filters — only final states (no manual pending) */
export const QUALIFICATION_FILTER_OPTIONS = ['qualified', 'unqualified'] as const
export type ActiveQualificationStatus = (typeof QUALIFICATION_FILTER_OPTIONS)[number]

export const SALES_STATUS_LABELS: Record<SalesWorkflowStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  follow_up: 'متابعة',
  no_answer: 'لا يجيب',
  interested: 'مهتم',
  not_interested: 'غير مهتم',
  converted: 'تم التحويل',
}

export const QUALIFICATION_ORDER: QualificationStatus[] = ['qualified', 'unqualified']

export const SALES_WORKFLOW_ORDER: SalesWorkflowStatus[] = [
  'new',
  'contacted',
  'follow_up',
  'no_answer',
  'interested',
  'not_interested',
  'converted',
]
