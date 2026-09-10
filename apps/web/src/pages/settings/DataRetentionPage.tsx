import { useState } from 'react'
import { format } from 'date-fns'
import { Download, HardDrive, Archive, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const RETENTION_OPTIONS = [
  { value: 'forever', label: 'Forever' },
  { value: '1y', label: '1 Year' },
  { value: '3y', label: '3 Years' },
  { value: '5y', label: '5 Years' },
  { value: '7y', label: '7 Years' },
]

const RETENTION_POLICIES = [
  { key: 'work_orders', label: 'Work Orders', default: 'forever' },
  { key: 'sensor_readings', label: 'Sensor Readings', default: '1y' },
  { key: 'iot_alerts', label: 'IoT Alerts', default: '3y' },
  { key: 'audit_logs', label: 'Audit Logs', default: '3y' },
  { key: 'activity_logs', label: 'Activity Logs', default: '1y' },
  { key: 'report_snapshots', label: 'Report Snapshots', default: '5y' },
]

const STORAGE_BREAKDOWN = [
  { label: 'Work Orders & Attachments', size: '2.3 GB', pct: 45, color: 'bg-brand-500' },
  { label: 'Sensor Readings', size: '1.8 GB', pct: 35, color: 'bg-green-500' },
  { label: 'Audit & Activity Logs', size: '0.6 GB', pct: 12, color: 'bg-amber-500' },
  { label: 'Report Snapshots', size: '0.4 GB', pct: 8, color: 'bg-purple-500' },
]

const MOCK_BACKUPS = [
  { id: '1', date: new Date(Date.now() - 2 * 3600000).toISOString(), size: '4.9 GB', status: 'success' },
  { id: '2', date: new Date(Date.now() - 26 * 3600000).toISOString(), size: '4.8 GB', status: 'success' },
  { id: '3', date: new Date(Date.now() - 50 * 3600000).toISOString(), size: '4.7 GB', status: 'success' },
  { id: '4', date: new Date(Date.now() - 74 * 3600000).toISOString(), size: '4.7 GB', status: 'failed' },
]

export function DataRetentionPage() {
  const { user } = useAuthStore()
  const [policies, setPolicies] = useState<Record<string, string>>(
    Object.fromEntries(RETENTION_POLICIES.map((p) => [p.key, p.default]))
  )
  const [triggering, setTriggering] = useState(false)

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Data Retention" description="Manage data retention and backups" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can manage data retention.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleTriggerBackup = () => {
    setTriggering(true)
    setTimeout(() => setTriggering(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Data Retention" description="Manage data retention policies and database backups" />

      {/* Storage Usage */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Storage Usage</h3>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <HardDrive className="h-4 w-4" />
              <span>5.1 GB / 10 GB</span>
            </div>
          </div>

          {/* Total bar */}
          <div className="relative">
            <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
              {STORAGE_BREAKDOWN.map((item) => (
                <div
                  key={item.label}
                  className={cn('h-full', item.color)}
                  style={{ width: `${item.pct}%` }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {STORAGE_BREAKDOWN.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', item.color)} />
                  <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div className={cn('h-1.5 rounded-full', item.color)} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">{item.size}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Retention Policies */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Retention Policies</h3>
          <p className="text-xs text-gray-400">Data older than the specified period will be automatically archived or deleted.</p>

          <div className="space-y-3">
            {RETENTION_POLICIES.map((policy) => (
              <div key={policy.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">{policy.label}</span>
                <select
                  value={policies[policy.key]}
                  onChange={(e) => setPolicies((prev) => ({ ...prev, [policy.key]: e.target.value }))}
                  className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm"
                >
                  {RETENTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <Button size="sm">Save Retention Policies</Button>
        </CardContent>
      </Card>

      {/* Backups */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Database Backups</h3>
            <p className="text-xs text-gray-400">Backups run daily at 2:00 AM UTC</p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Download Latest
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTriggerBackup}
              disabled={triggering}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', triggering && 'animate-spin')} />
              {triggering ? 'Triggering…' : 'Trigger Backup Now'}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400 uppercase">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Size</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_BACKUPS.map((backup) => (
                  <tr key={backup.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2.5 text-gray-700 dark:text-gray-300">
                      {format(new Date(backup.date), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-2.5 text-gray-500">{backup.size}</td>
                    <td className="py-2.5">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        backup.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                      )}>
                        {backup.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {backup.status === 'success' && (
                        <button className="text-brand-600 hover:text-brand-700 text-xs">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
