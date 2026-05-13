/**
 * Flexible inbound funnel payload contract (browser `fetch`, server webhook, Zapier/Make, etc.).
 *
 * Canonical lead fields mirror `lib/validations/leads` (`funnelLeadSubmitSchema`).
 * `lib/leads/map-funnel-payload` maps alternate English / Arabic / vendor keys onto that shape.
 *
 * Allowlist only for persistence; unknown keys are ignored after mapping unless they feed UTM/meta.
 */

/** Raw identity & contact — many aliases accepted by the mapper */
export interface FunnelFlexibleIdentityInbound {
  first_name?: string
  family_name?: string
  last_name?: string
  /** Split when your form only exposes one name box */
  full_name?: string
  phone_number?: string
  phone?: string
  mobile?: string
  email?: string
  city?: string
}

/** Eligibility blocks (Arabic dropdown labels kept verbatim in DB `*_raw` columns). */
export interface FunnelFlexibleEligibilityInbound extends FunnelFlexibleIdentityInbound {
  has_existing_mortgage?: boolean | string
  salary_range_raw?: string
  salary?: string
  housing_support_raw?: string
  bank_name?: string
  employer_raw?: string
  employer?: string
  requested_amount_raw?: string
  has_service_hold?: boolean | string
  financing_need_raw?: string
}

/** Attribution / timestamps */
export interface FunnelFlexibleTrackingInbound extends FunnelFlexibleEligibilityInbound {
  visit_source_raw?: string
  traffic_source?: string
  campaign_raw?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  /** Optional page URL captured client-side */
  funnel_page?: string
  landing_page?: string
  submitted_date?: string | null
  submitted_time?: string | null
}

/**
 * Spam traps: include as **hidden inputs** named like `_trap`; never populate from real users.
 */
export interface FunnelAntiSpamInbound {
  _trap?: string
  _gotcha?: string
  company_website?: string
}

export type FlexibleFunnelSubmitPayload = FunnelFlexibleTrackingInbound & FunnelAntiSpamInbound
