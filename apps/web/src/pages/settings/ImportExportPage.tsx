import { useState } from 'react'
import { Download, Upload, Database, FileText, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useLoadSampleData, useRemoveSampleData, useSampleData } from '@/hooks/useSampleData'

const SAMPLE_LABELS: Record<string, string> = {
  Location: 'places', Asset: 'assets', Part: 'parts', PreventiveMaintenance: 'PM schedules', WorkOrder: 'work orders',
}

/** Example data to look around in, kept apart from the real data so it can be taken out cleanly. */
function SampleDataSection() {
  const { data: sample } = useSampleData()
  const load = useLoadSampleData()
  const remove = useRemoveSampleData()
  const [kept, setKept] = useState<{ type: string; name: string; reason: string }[]>([])

  const removeSample = () => {
    if (!confirm('Remove the sample data? Anything you added yourself stays. Sample items you have since built on are kept.')) return
    remove.mutate(undefined, { onSuccess: (result) => setKept(result.report.kept) })
  }
  const counts = sample ? Object.entries(sample.counts).filter(([, n]) => n > 0).map(([type, n]) => `${n} ${SAMPLE_LABELS[type] ?? type}`).join(', ') : ''

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Sample data</h3>
        <p className="text-sm text-gray-500">
          Fills your company with a few places, assets, parts, a PM schedule and work orders (all named &ldquo;Sample: …&rdquo;) so you can see what FixFlow looks like with something in it.
          It creates no accounts and sends no email, and you can remove it again at any time without touching what you have added yourself.
        </p>
        {sample?.loaded ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/10">
            <p className="text-sm text-amber-800 dark:text-amber-300">Sample data is loaded: {counts}.</p>
            <Button size="sm" variant="outline" onClick={removeSample} disabled={remove.isPending}>{remove.isPending ? 'Removing…' : 'Remove sample data'}</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => load.mutate()} disabled={load.isPending || !sample}>
            {load.isPending ? 'Adding…' : 'Add sample data'}
          </Button>
        )}
        {kept.length > 0 && (
          <div role="status" className="rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <p className="font-medium">Kept, because you built on them (they are yours now):</p>
            <ul className="mt-1 list-disc pl-5 text-xs">{kept.map((k) => <li key={`${k.type}-${k.name}`}>{k.name}: {k.reason}</li>)}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ImportExportPage() {
  const { user } = useAuthStore()
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Import / Export" description="Import and export organization data" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can manage data import/export.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleExport = (type: string) => {
    setExporting(type)
    setTimeout(() => setExporting(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Import / Export" description="Import and export your organization's data" />

      {/* Export Section */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Export Data</h3>
          <p className="text-sm text-gray-500">
            Download your organization's data as CSV or JSON format.
          </p>

          <div className="space-y-3">
            {/* Full Export */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-brand-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Export All Data</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    All work orders, assets, PM schedules, IoT rules, and users in JSON format.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport('all')}
                disabled={exporting === 'all'}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {exporting === 'all' ? 'Preparing…' : 'Export All'}
              </Button>
            </div>

            {/* Migration Export */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Export for Migration</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Structured export for migrating to another FixFlow instance.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport('migration')}
                disabled={exporting === 'migration'}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {exporting === 'migration' ? 'Preparing…' : 'Export'}
              </Button>
            </div>

            {/* Individual exports */}
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Individual Data Types</p>
              <div className="grid grid-cols-2 gap-2">
                {['Assets (CSV)', 'Work Orders (CSV)', 'PM Schedules (CSV)', 'Users (CSV)'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleExport(item)}
                    disabled={exporting === item}
                    className="flex items-center gap-2 px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-left"
                  >
                    <Download className="h-3 w-3 shrink-0" />
                    {exporting === item ? 'Preparing…' : item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SampleDataSection />

      {/* Import Section */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Import Data</h3>

          <div className="space-y-3">
            {/* Asset Import */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <Upload className="h-5 w-5 text-brand-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Import locations, assets and parts</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Upload a CSV file to bulk-import locations, assets or parts. The import page has a template for each, and checks your file before anything is imported.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.location.href = '/import?kind=assets'
                }}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Import
              </Button>
            </div>

            {/* WO Import — Coming Soon */}
            <div className="flex items-start gap-4 p-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 opacity-60">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-gray-600 dark:text-gray-400">Work Order Import</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Bulk import of historical work orders — coming in a future update.
                  </p>
                </div>
              </div>
            </div>

            {/* Restore from Backup */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Restore from Backup</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Restore your database from a previous backup. This will overwrite all current data.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 shrink-0"
                disabled
              >
                Restore
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
