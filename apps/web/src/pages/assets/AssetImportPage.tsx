import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { ArrowLeft, Upload, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useCreateAsset } from '@/hooks/useAssets'
import { useLocations } from '@/hooks/useLocations'
import { cn } from '@/lib/utils'
import type { AssetStatus } from '@/types'

const CSV_TEMPLATE_HEADERS = ['name', 'asset_tag', 'serial_number', 'status', 'location_name', 'manufacturer', 'model', 'year'].join(',')
const VALID_STATUSES: AssetStatus[] = ['operational', 'degraded', 'down', 'maintenance', 'offline']

interface ParsedRow {
  row: number
  name: string
  asset_tag?: string
  serial_number?: string
  status: string
  location_name?: string
  manufacturer?: string
  model?: string
  year?: string
  errors: string[]
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''))
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''))
    const obj: Record<string, string> = {}
    headers.forEach((h, j) => { obj[h] = values[j] ?? '' })

    const errors: string[] = []
    if (!obj.name?.trim()) errors.push('Name is required')
    if (obj.status && !VALID_STATUSES.includes(obj.status as AssetStatus)) {
      errors.push(`Invalid status "${obj.status}" (use: ${VALID_STATUSES.join(', ')})`)
    }

    rows.push({
      row: i,
      name: obj.name ?? '',
      asset_tag: obj.asset_tag || undefined,
      serial_number: obj.serial_number || undefined,
      status: obj.status || 'operational',
      location_name: obj.location_name || undefined,
      manufacturer: obj.manufacturer || undefined,
      model: obj.model || undefined,
      year: obj.year || undefined,
      errors,
    })
  }
  return rows
}

export function AssetImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<{ created: number; skipped: string[] } | null>(null)
  const createMutation = useCreateAsset()
  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setRows(parsed)
      setStep(2)
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  })

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_HEADERS + '\nPump-01,FF-000001,SN001,operational,Building A,Grundfos,CM5,2020\n'], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'assets-template.csv'
    a.click()
  }

  const validRows = rows.filter((r) => r.errors.length === 0)
  const invalidRows = rows.filter((r) => r.errors.length > 0)

  const handleImport = async () => {
    setStep(3)
    const skipped: string[] = []
    let created = 0

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      try {
        const locationId = row.location_name
          ? locations.find((l) => l.name.toLowerCase() === row.location_name?.toLowerCase())?.id
          : undefined

        await createMutation.mutateAsync({
          name: row.name,
          asset_tag: row.asset_tag,
          serial_number: row.serial_number,
          status: (VALID_STATUSES.includes(row.status as AssetStatus) ? row.status : 'operational') as AssetStatus,
          location_id: locationId,
          manufacturer: row.manufacturer,
          model: row.model,
          year_manufactured: row.year ? parseInt(row.year, 10) : undefined,
        })
        created++
      } catch {
        skipped.push(`Row ${row.row}: ${row.name}`)
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100))
    }
    setImportResults({ created, skipped })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/assets">
          <ArrowLeft className="h-4 w-4" />
          Assets
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Import Assets</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Upload a CSV file to bulk import assets.</p>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Upload CSV</h2>
              <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </div>

            <div
              {...getRootProps()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors cursor-pointer',
                isDragActive
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/50',
              )}
              aria-label="Drop CSV file here or click to browse"
            >
              <input {...getInputProps()} aria-label="CSV file input" />
              <Upload className="h-8 w-8 text-gray-400" aria-hidden="true" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isDragActive ? 'Drop the file here' : 'Drop CSV here or click to browse'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">CSV only, max 5MB</p>
              </div>
            </div>

            <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Required columns:</strong> name, status<br />
                <strong>Optional:</strong> asset_tag, serial_number, location_name, manufacturer, model, year
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              {validRows.length} valid
            </span>
            {invalidRows.length > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                {invalidRows.length} errors
              </span>
            )}
          </div>

          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <div className="overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      {['Row', 'Name', 'Status', 'Location', 'Errors'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rows.map((row) => (
                      <tr key={row.row} className={row.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="px-3 py-2 text-gray-500">{row.row}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                        <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-400">{row.status}</td>
                        <td className="px-3 py-2 text-gray-500">{row.location_name ?? '—'}</td>
                        <td className="px-3 py-2 text-red-600 dark:text-red-400">
                          {row.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleImport} disabled={validRows.length === 0}>
              Import {validRows.length} asset{validRows.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 3 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            {!importResults ? (
              <>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Importing…</h2>
                <div className="overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-brand-600 transition-all"
                    style={{ width: `${importProgress}%` }}
                    role="progressbar"
                    aria-valuenow={importProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-sm text-gray-500">{importProgress}%</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <h2 className="font-semibold">Import Complete</h2>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  ✅ {importResults.created} asset{importResults.created !== 1 ? 's' : ''} created
                </p>
                {importResults.skipped.length > 0 && (
                  <div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      ⚠️ {importResults.skipped.length} rows skipped
                    </p>
                    <ul className="mt-1 list-inside list-disc text-xs text-gray-500">
                      {importResults.skipped.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <Button onClick={() => navigate('/assets')}>
                  <FileText className="h-4 w-4" />
                  View Imported Assets
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
