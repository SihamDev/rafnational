import { z } from 'zod'

const yn = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return undefined
    if (typeof v === 'boolean') return v ? true : false
    const s = String(v).trim()
    if (s === 'نعم' || s.toLowerCase() === 'yes' || s === 'true' || s === '1') return true
    if (s === 'لا' || s.toLowerCase() === 'no' || s === 'false' || s === '0') return false
    if (s === 'اختر الإجابة') return undefined
    return undefined
  })

/** Public funnel submissions (Arabic originals stay in *_raw strings from the form mapper) */
export const funnelLeadSubmitSchema = z.object({
  first_name: z.string().trim().min(1, 'اسم الأول مطلوب').max(200),
  family_name: z.string().trim().max(200).optional().nullable(),
  phone_number: z.string().trim().min(7, 'رقم جوال مطلوب').max(30),
  email: z
    .string()
    .max(320)
    .optional()
    .nullable()
    .transform((s) =>
      !s || !String(s).trim() ? null : String(s).trim().toLowerCase()
    )
    .refine((s) => !s || z.string().email().safeParse(s).success, 'بريد غير صالح'),
  city: z.string().trim().max(120).optional().nullable(),
  has_existing_mortgage: yn,
  bank_name: z.string().trim().max(200).optional().nullable(),
  salary_range_raw: z.string().trim().max(200).optional().nullable(),
  housing_support_raw: z.string().trim().max(200).optional().nullable(),
  employer_raw: z.string().trim().max(240).optional().nullable(),
  requested_amount_raw: z.string().trim().max(80).optional().nullable(),
  has_service_hold: yn,
  financing_need_raw: z.string().trim().max(200).optional().nullable(),
  visit_source_raw: z.string().trim().max(160).optional().nullable(),
  /** UTM/meta — long strings allowed for webhook JSON joined with separators */
  campaign_raw: z.string().trim().max(4000).optional().nullable(),
  submitted_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صالح')
    .optional()
    .nullable(),
  submitted_time: z.string().max(40).optional().nullable(),
})

export type FunnelLeadSubmitInput = z.infer<typeof funnelLeadSubmitSchema>
