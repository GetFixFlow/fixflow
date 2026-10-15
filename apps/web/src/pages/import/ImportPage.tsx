import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { AlertCircle, CheckCircle, Download, FileText, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { importsApi, type ImportKind, type ImportReport } from '@/api/imports'
import { cn } from '@/lib/utils'

const KINDS: { kind: ImportKind; label: string; singular: string; list: string; columns: string; note: string }[] = [
  {
    kind: 'locations', label: 'Locations', singular: 'location', list: '/locations',
    columns: 'name (required), type, parent',
    note: 'Do these first. A row can sit under one made earlier in the same file. Give the parent as a name or a full path such as Plant > Floor 1. Type is one of site, building, floor, zone, room, outdoor.',
  },
  {
    kind: 'assets', label: 'Assets', singular: 'asset', list: '/assets',
    columns: 'name (required), asset_tag, serial_number, status, location',
    note: 'Location must already exist (use its name, or its full path if the name is shared). Any other column, such as manufacturer or year, is kept with the asset as a custom field. A blank asset_tag is made up for you.',
  },
  {
    kind: 'parts', label: 'Parts', singular: 'part', list: '/parts',
    columns: 'name (required), sku, quantity_on_hand, reorder_point, unit, unit_cost, location',
    note: 'Each SKU can be used once. Numbers use a decimal point (12.50) or, in a file separated by semicolons, a comma (12,50).',
  },
]

const isKind = (value: string | null): value is ImportKind => KINDS.some((k) => k.kind === value)

const messageFrom = (error: unknown) =>
  (error as AxiosError<{ error?: { message?: string } }>).response?.data?.error?.message ?? 'The file could not be checked. Try again.'

/** The problems as a CSV, to work through in a spreadsheet next to the file. */
function problemsCsv(report: ImportReport) {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  return ['row,column,problem', ...report.errors.map((e) => [e.row, e.column, e.message].map(quote).join(','))].join('\n')
}

function download(text: string, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function ImportPage() {
  const [params, setParams] = useSearchParams()
  const kind: ImportKind = isKind(params.get('kind')) ? (params.get('kind') as ImportKind) : 'assets'
  const info = KINDS.find((k) => k.kind === kind)!
  const qc = useQueryClient()

  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [done, setDone] = useState<ImportReport | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const reset = () => { setFile(null); setReport(null); setDone(null); setProblem(null) }

  const check = useMutation({
    mutationFn: (f: File) => importsApi.preview(kind, f).then((r) => r.data),
    onSuccess: setReport,
    onError: (e) => { setReport(null); setProblem(messageFrom(e)) },
  })

  const run = useMutation({
    mutationFn: (f: File) => importsApi.commit(kind, f).then((r) => r.data),
    onSuccess: (result) => {
      setDone(result)
      // Whatever lists show these things are out of date now.
      qc.invalidateQueries({ queryKey: [kind] })
      qc.invalidateQueries({ queryKey: ['locations'] })
    },
    onError: (e) => {
      const reportBody = (e as AxiosError<ImportReport>).response?.data
      if (reportBody && 'errors' in reportBody) setReport(reportBody) // the file changed since it was checked
      else setProblem(messageFrom(e))
    },
  })

  const onDrop = useCallback((accepted: File[]) => {
    const chosen = accepted[0]
    if (!chosen) return
    reset()
    setFile(chosen)
    check.mutate(chosen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'], 'application/vnd.ms-excel': ['.csv'] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onDropRejected: () => setProblem('Choose a .csv file of 5 MB or less. In Excel use File, Save As, CSV.'),
  })

  const downloadTemplate = async () => {
    try {
      const { data } = await importsApi.template(kind)
      download(data, `${kind}_template.csv`)
    } catch (e) {
      setProblem(messageFrom(e))
    }
  }

  const choose = (next: ImportKind) => { reset(); setParams({ kind: next }) }
  const columns = report ? [...report.columns.known, ...report.columns.custom] : []

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Import data" description="Bring locations, assets and parts in from a spreadsheet saved as CSV" />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="What to import">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            role="tab"
            aria-selected={k.kind === kind}
            onClick={() => choose(k.kind)}
            className={cn(
              'rounded-md border px-4 py-2 text-sm font-medium',
              k.kind === kind ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">1. Get the template</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">Columns: <span className="font-mono text-xs">{info.columns}</span></p>
          <p className="text-sm text-gray-500">{info.note}</p>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download the {info.singular} template
          </Button>
        </CardContent>
      </Card>

      {!done && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">2. Choose your file</h2>
            <div
              {...getRootProps()}
              className={cn(
                'flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-8 text-center',
                isDragActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 hover:border-gray-400 dark:border-gray-600',
              )}
            >
              <input {...getInputProps()} aria-label="CSV file" />
              {file ? <FileText className="mb-2 h-8 w-8 text-brand-500" /> : <Upload className="mb-2 h-8 w-8 text-gray-400" />}
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{file ? file.name : 'Drag your CSV here, or click to choose it'}</p>
              <p className="mt-1 text-xs text-gray-400">Up to 5 MB and 5,000 rows. Nothing is imported until you confirm.</p>
            </div>

            {check.isPending && <p className="text-sm text-gray-500">Checking the file…</p>}
            {problem && (
              <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {problem}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {report && !done && report.error_count > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" /> {report.error_count} problem{report.error_count === 1 ? '' : 's'} to fix
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Nothing has been imported. Correct the rows below in your file and choose it again: rows that were fine will not be doubled up.
            </p>
            <div className="max-h-96 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-700/50">
                  <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Column</th><th className="px-3 py-2">Problem</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {report.errors.map((e, i) => (
                    <tr key={i}><td className="px-3 py-2 tabular-nums">{e.row}</td><td className="px-3 py-2 font-mono text-xs">{e.column}</td><td className="px-3 py-2">{e.message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.errors_truncated && <p className="text-xs text-gray-500">Showing the first {report.errors.length} of {report.error_count}. Fix these and check again to see the rest.</p>}
            <Button variant="outline" size="sm" onClick={() => download(problemsCsv(report), `${kind}_problems.csv`)}>
              <Download className="h-4 w-4" /> Download this list
            </Button>
          </CardContent>
        </Card>
      )}

      {report && !done && report.error_count === 0 && file && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" /> {report.total_rows} row{report.total_rows === 1 ? '' : 's'} ready to import
            </h2>
            {report.columns.custom.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                These columns are not standard and will be kept as custom fields: <strong>{report.columns.custom.join(', ')}</strong>.
              </p>
            )}
            <div className="overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-700/50">
                  <tr>{columns.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {report.preview.map((row, i) => (
                    <tr key={i}>{columns.map((c) => <td key={c} className="px-3 py-2">{row[c] || <span className="text-gray-300">—</span>}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.total_rows > report.preview.length && <p className="text-xs text-gray-500">Showing the first {report.preview.length} rows.</p>}
            <div className="flex gap-2">
              <Button onClick={() => run.mutate(file)} disabled={run.isPending}>
                {run.isPending ? 'Importing…' : `Import ${report.total_rows} ${report.total_rows === 1 ? info.singular : `${info.singular}s`}`}
              </Button>
              <Button variant="ghost" onClick={reset}>Choose a different file</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {done && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" /> Imported {done.created} {done.created === 1 ? info.singular : `${info.singular}s`}
            </h2>
            <div className="flex gap-2">
              <Link to={info.list}><Button>View {info.label.toLowerCase()}</Button></Link>
              <Button variant="outline" onClick={reset}>Import another file</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
