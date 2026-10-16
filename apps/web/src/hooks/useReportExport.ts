import { useCallback, useState } from 'react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { reportsApi, type ReportFormat } from '@/api/reports'
import { triggerDownload } from '@/services/exportService'

function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

/** What went wrong, in words. An error answer to a file request arrives as a blob, so it is read as text first. */
export async function exportErrorMessage(error: unknown): Promise<string> {
  if (isAxiosError(error) && error.response) {
    const { status, data } = error.response
    if (status === 403) return 'Only managers and administrators can export reports.'
    if (status === 406) return 'This report cannot be exported in that format.'
    if (status === 429) return 'Too many requests. Wait a moment and try again.'
    try {
      const text = data instanceof Blob ? await readText(data) : JSON.stringify(data)
      const message = JSON.parse(text)?.error?.message
      if (typeof message === 'string' && message) return message
    } catch {
      // Not the usual error body: fall through to the general message.
    }
  }
  return 'The export could not be created. Try again.'
}

/** Downloads a report as a CSV or PDF file, with the same filters and dates as the screen's own request. */
export function useReportExport() {
  const [exporting, setExporting] = useState(false)

  const exportReport = useCallback(async (path: string, format: ReportFormat, params?: Record<string, unknown>) => {
    setExporting(true)
    try {
      const file = await reportsApi.download(path, format, params)
      triggerDownload(file.blob, file.filename)
      if (file.truncated) {
        toast.warning('The file holds only the first 50,000 rows. Narrow the dates or filters to get the rest.')
      }
    } catch (error) {
      toast.error(await exportErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }, [])

  return { exporting, exportReport }
}
