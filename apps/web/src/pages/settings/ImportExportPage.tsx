import { useState } from 'react'
import { Download, Upload, Database, FileText, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'

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
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Import Assets</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Upload a CSV file to bulk-import assets. Download the{' '}
                    <button className="text-brand-600 hover:underline">template CSV</button> to get started.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.location.href = '/assets/import'
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
