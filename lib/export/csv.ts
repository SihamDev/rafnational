/**
 * Export rows to CSV and trigger browser download.
 * Runs fully in the browser — no external library needed.
 */
export function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return

  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\r\n')

  const bom = '\uFEFF' // UTF-8 BOM for Excel Arabic support
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
