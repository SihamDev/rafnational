import type { FunnelLeadSubmitInput } from '@/lib/validations/leads'

type UnknownRecord = Record<string, unknown>

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

function pickFirst(rec: UnknownRecord, keys: string[]): unknown {
  for (const k of keys) {
    const lk = Object.keys(rec).find((x) => x.toLowerCase() === k.toLowerCase())
    if (
      lk !== undefined &&
      rec[lk] !== undefined &&
      rec[lk] !== null &&
      String(rec[lk]).trim() !== ''
    ) {
      return rec[lk]
    }
    if (
      k in rec &&
      rec[k] !== undefined &&
      rec[k] !== null &&
      String(rec[k]).trim() !== ''
    ) {
      return rec[k]
    }
  }
  return undefined
}

/** Split full name → first + family (best-effort). */
function splitFullName(full: string): { first: string; family?: string } {
  const t = full.trim()
  if (!t) return { first: '' }
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { first: parts[0] }
  return { first: parts[0], family: parts.slice(1).join(' ') }
}

/**
 * Maps inbound JSON (ClickFunnels webhooks, custom fetch, Zapier aliases) onto
 * the shape expected by `funnelLeadSubmitSchema`.
 * Mirrors [Raf Nationals funnel steps](https://www.rafnationals.com/funnel1): الاسم، الجوال، المدينة، الأهلية، تفاصيل الطلب، UTM.
 */
export function mapInboundFunnelJson(raw: unknown): FunnelLeadSubmitInput {
  const o = typeof raw === 'object' && raw !== null ? (raw as UnknownRecord) : {}

  let first = str(pickFirst(o, ['first_name', 'firstName', 'First Name', 'الاسم_الاول', 'الاسم الأول']))
  let family =
    str(pickFirst(o, ['family_name', 'last_name', 'lastName', 'Last Name', 'اسم العائلة', 'اسم_العائلة'])) ??
    null

  const fullRaw = pickFirst(o, ['full_name', 'Full Name', 'name', 'Name', 'الاسم الكامل'])
  const fullParsed =
    typeof fullRaw === 'string' ? splitFullName(fullRaw) : { first: '', family: undefined as string | undefined }
  if (!first && fullParsed.first) first = fullParsed.first
  if ((!family || family.trim() === '') && fullParsed.family) family = fullParsed.family

  let phoneRaw =
    str(
      pickFirst(o, [
        'phone_number',
        'fullPhone',
        'Phone',
        'phone',
        'Mobile',
        'mobile',
        'جوال',
        'contact_number',
      ]),
    ) ?? ''

  /* ClickFunnels often sends "+9665xxxxxxxx"; DB insert stores display form — normalization uses digits */
  phoneRaw = phoneRaw.replace(/^\+966\s?/i, '').replace(/^966/, '').trim()
  const phone = phoneRaw.startsWith('0') ? phoneRaw.slice(1) : phoneRaw

  const emailRaw = pickFirst(o, ['email', 'Email', 'البريد', 'البريد الالكتروني'])
  let emailVal: string | null = null
  if (typeof emailRaw === 'string') emailVal = emailRaw.trim().toLowerCase() || null
  else if (emailRaw != null) emailVal = String(emailRaw).trim().toLowerCase() || null

  const visitExplicit = str(
    pickFirst(o, ['visit_source_raw', 'traffic_source', 'source_label', 'referrer']),
  )
  const utmSource = str(pickFirst(o, ['utm_source']))
  const utmMedium = str(pickFirst(o, ['utm_medium']))
  const utmCampaign = str(pickFirst(o, ['utm_campaign', 'campaign']))
  const utmTerm = str(pickFirst(o, ['utm_term']))
  const utmContent = str(pickFirst(o, ['utm_content']))
  const funnelPage = str(pickFirst(o, ['funnel_page', 'page_url', 'pageUrl', 'landing_page']))

  const baseCampaign = str(pickFirst(o, ['campaign_raw', 'campaign_id', 'campaign_name']))
  const utmLine = [
    utmMedium && `utm_medium=${utmMedium}`,
    utmCampaign && `utm_campaign=${utmCampaign}`,
    utmTerm && `utm_term=${utmTerm}`,
    utmContent && `utm_content=${utmContent}`,
    funnelPage && `page=${funnelPage}`,
  ]
    .filter(Boolean)
    .join(' ')
  let campaignMerged: string | null = baseCampaign ?? null
  if (utmLine) campaignMerged = campaignMerged ? `${campaignMerged} | ${utmLine}` : utmLine

  const funnelVendorTag = str(pickFirst(o, ['funnel_vendor', 'marketing_platform']))
  if (funnelVendorTag) {
    campaignMerged = campaignMerged
      ? `${campaignMerged} | vendor=${funnelVendorTag}`
      : `vendor=${funnelVendorTag}`
  }

  const visitMerged =
    visitExplicit ??
    utmSource ??
    (funnelVendorTag ? `CRM:${funnelVendorTag}` : null)

  return {
    first_name: first ?? '',
    family_name: family,
    phone_number: phone ?? '',
    email: emailVal,
    city: str(pickFirst(o, ['city', 'City', 'المدينة'])) ?? null,
    has_existing_mortgage: pickFirst(o, [
      'has_existing_mortgage',
      'existing_mortgage',
      'Mortgage',
      'hasMortgage',
    ]) as FunnelLeadSubmitInput['has_existing_mortgage'],
    bank_name:
      str(pickFirst(o, ['bank_name', 'employer_bank', 'Bank', 'bank'])) ?? null,
    salary_range_raw:
      str(pickFirst(o, ['salary_range_raw', 'Salary', 'salary'])) ?? null,
    housing_support_raw:
      str(pickFirst(o, ['housing_support_raw', 'housing', 'housing_support', 'sakaniSupport'])) ?? null,
    employer_raw:
      str(pickFirst(o, ['employer_raw', 'Employer', 'employer', 'جهة العمل', 'sector'])) ?? null,
    requested_amount_raw:
      str(pickFirst(o, ['requested_amount_raw', 'requested_amount', 'Amount', 'loanAmount'])) ?? null,
    has_service_hold: pickFirst(o, [
      'has_service_hold',
      'service_hold',
      'stopServices',
    ]) as FunnelLeadSubmitInput['has_service_hold'],
    financing_need_raw:
      str(pickFirst(o, [
        'financing_need_raw',
        'Financing_need',
        'financing_need',
        'need',
        'urgency',
      ])) ?? null,
    visit_source_raw: visitMerged,
    campaign_raw: campaignMerged,
    submitted_date: str(pickFirst(o, ['submitted_date'])) as FunnelLeadSubmitInput['submitted_date'],
    submitted_time: str(pickFirst(o, ['submitted_time'])) as FunnelLeadSubmitInput['submitted_time'],
  }
}
