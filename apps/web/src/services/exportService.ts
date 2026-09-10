import { format } from 'date-fns'

// Install check: use dynamic imports for optional deps
// npm install papaparse @types/papaparse xlsx

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else if (value instanceof Date) {
      result[fullKey] = value.toISOString()
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[fullKey] = value
    } else {
      result[fullKey] = String(value ?? '')
    }
  }
  return result
}

export function exportToCSV(data: object[], filename: string, from?: Date, to?: Date): void {
  if (data.length === 0) return
  const flattened = data.map((row) => flattenObject(row as Record<string, unknown>))
  const headers = [...new Set(flattened.flatMap((r) => Object.keys(r)))]
  const rows = [
    headers.join(','),
    ...flattened.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? '')
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"` : val
      }).join(','),
    ),
  ]
  const dateStr = from && to ? `_${format(from, 'yyyyMMdd')}_${format(to, 'yyyyMMdd')}` : ''
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${filename}${dateStr}.csv`)
}

export function exportToExcel(sheets: { name: string; data: object[] }[], filename: string, from?: Date, to?: Date): void {
  // Dynamic import to avoid bundle size impact
  import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new()
    for (const sheet of sheets) {
      if (sheet.data.length === 0) continue
      const ws = XLSX.utils.json_to_sheet(sheet.data)
      // Auto column widths
      const colWidths = Object.keys(sheet.data[0] ?? {}).map((k) => ({ wch: Math.max(k.length, 12) }))
      ws['!cols'] = colWidths
      // Freeze header row
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
    }
    const dateStr = from && to ? `_${format(from, 'yyyyMMdd')}_${format(to, 'yyyyMMdd')}` : ''
    XLSX.writeFile(wb, `${filename}${dateStr}.xlsx`)
  }).catch(() => {
    console.warn('xlsx not installed. Run: npm install xlsx')
  })
}

export async function exportToPDF(apiPath: string, params?: Record<string, unknown>, filename = 'report.pdf'): Promise<void> {
  const { apiClient } = await import('@/api/client')
  const response = await apiClient.get(apiPath, { params, responseType: 'blob' })
  triggerDownload(new Blob([response.data as BlobPart], { type: 'application/pdf' }), filename)
}

export function copyShareLink(extraParams?: Record<string, string>): void {
  const url = new URL(window.location.href)
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v)
  }
  navigator.clipboard.writeText(url.toString()).then(() => {
    import('sonner').then(({ toast }) => toast.success('Link copied to clipboard!'))
  })
}
