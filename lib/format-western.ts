/**
 * Western digits (0–9) everywhere — `toLocaleString('en-US')` still emits
 * Arabic-Indic digits in some browsers when `dir="rtl"` / Arabic UI is active.
 * `numberingSystem: 'latn'` forces identical server + client output.
 */

const westernInt = new Intl.NumberFormat('en-US', {
  numberingSystem: 'latn',
  maximumFractionDigits: 0,
})

export function formatWesternInt(n: number): string {
  return westernInt.format(n)
}

export function formatWesternNumber(n: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', {
    numberingSystem: 'latn',
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(n)
}

const westernDateOnly = new Intl.DateTimeFormat('en-CA', {
  numberingSystem: 'latn',
  calendar: 'gregory',
  timeZone: 'Asia/Riyadh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const westernDateTime = new Intl.DateTimeFormat('en-US', {
  numberingSystem: 'latn',
  calendar: 'gregory',
  timeZone: 'Asia/Riyadh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Short date + time — Arabic month labels, Latin digits (good for RTL UI). */
const westernShortDateTime = new Intl.DateTimeFormat('ar-SA', {
  numberingSystem: 'latn',
  calendar: 'gregory',
  timeZone: 'Asia/Riyadh',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Long weekday date for banners */
const westernLongDateAr = new Intl.DateTimeFormat('ar-SA', {
  numberingSystem: 'latn',
  calendar: 'gregory',
  timeZone: 'Asia/Riyadh',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export function formatWesternDateOnly(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return westernDateOnly.format(d)
}

export function formatWesternDateTime(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return westernDateTime.format(d)
}

export function formatWesternShortDateTime(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return westernShortDateTime.format(d)
}

export function formatWesternLongDateAr(input: string | Date = new Date()): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return westernLongDateAr.format(d)
}
