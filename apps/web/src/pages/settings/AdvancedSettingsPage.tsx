import { useState } from 'react'
import { AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const PUBLIC_PORTAL_URL = 'https://fixflow.io/request/demo-manufacturing'

const SYSTEM_INFO = [
  { label: 'FixFlow Version', value: '0.1.0 (Session 15)' },
  { label: 'Environment', value: 'Production' },
  { label: 'Rails Version', value: '7.2.0' },
  { label: 'Ruby Version', value: '3.3.0' },
  { label: 'PostgreSQL Version', value: '16.2' },
  { label: 'Redis Version', value: '7.2.3' },
  { label: 'Node Version', value: '20.11.0' },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

export function AdvancedSettingsPage() {
  const { user } = useAuthStore()

  const [allowRegistration, setAllowRegistration] = useState(false)
  const [publicPortalEnabled, setPublicPortalEnabled] = useState(true)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState("FixFlow is temporarily down for maintenance. We'll be back shortly.")
  const [checking, setChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'latest' | 'available'>('idle')
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Delete org dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const ORG_NAME = 'Demo Manufacturing Co.'

  // Reset demo data dialog
  const [showResetDialog, setShowResetDialog] = useState(false)

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Advanced Settings" description="Advanced system configuration" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can access advanced settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleCheckUpdates = () => {
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      setUpdateStatus('latest')
    }, 1500)
  }

  const copyPortalUrl = () => {
    navigator.clipboard.writeText(PUBLIC_PORTAL_URL)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Advanced Settings" description="Advanced system configuration and danger zone" />

      {/* Application Settings */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Application Settings</h3>

          {/* User Registration */}
          <div className="flex items-start justify-between py-3 border-b border-gray-50 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Allow Self-Registration</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Allow new users to sign up without an invitation link.
              </p>
            </div>
            <Toggle checked={allowRegistration} onChange={setAllowRegistration} />
          </div>

          {/* Public Portal */}
          <div className="py-3 border-b border-gray-50 dark:border-gray-700 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Public Work Request Portal</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Allow external users to submit maintenance requests without logging in.
                </p>
              </div>
              <Toggle checked={publicPortalEnabled} onChange={setPublicPortalEnabled} />
            </div>
            {publicPortalEnabled && (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-gray-600 dark:text-gray-400 flex-1 truncate">
                  {PUBLIC_PORTAL_URL}
                </code>
                <button onClick={copyPortalUrl} className="text-gray-400 hover:text-gray-600 shrink-0">
                  {copiedUrl ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
                <a
                  href={PUBLIC_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-brand-600 shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>

          {/* Maintenance Mode */}
          <div className="py-3 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Maintenance Mode</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Show a maintenance page to all non-admin users.
                </p>
              </div>
              <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} />
            </div>
            {maintenanceMode && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Maintenance Message
                </label>
                <textarea
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none"
                />
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Maintenance mode is active. Only admins can access FixFlow.
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button size="sm">Save Application Settings</Button>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">System Information</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckUpdates}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check for Updates'}
            </Button>
          </div>

          {updateStatus === 'latest' && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/10 rounded-lg px-3 py-2">
              <Check className="h-4 w-4" /> You're running the latest version.
            </div>
          )}

          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {SYSTEM_INFO.map((info) => (
              <div key={info.label} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">{info.label}</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{info.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold text-red-700 dark:text-red-400">Danger Zone</h3>
          </div>
          <p className="text-xs text-gray-500">
            These actions are irreversible. Proceed with extreme caution.
          </p>

          <div className="space-y-3">
            {/* Reset Demo Data */}
            {process.env.NODE_ENV === 'development' && (
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-dashed border-red-200 dark:border-red-800">
                <div>
                  <p className="font-medium text-sm text-red-700 dark:text-red-400">Reset Demo Data</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Wipe all demo data and re-seed with factory defaults. Dev only.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 shrink-0"
                  onClick={() => setShowResetDialog(true)}
                >
                  Reset Data
                </Button>
              </div>
            )}

            {/* Delete Organization */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
              <div>
                <p className="font-medium text-sm text-red-700 dark:text-red-400">Delete Organization</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Permanently delete this organization and all its data. This cannot be undone.
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="shrink-0"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Demo Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <h3 className="font-semibold">Reset Demo Data?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              This will delete all current data and replace it with demo data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowResetDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setShowResetDialog(false)
                  alert('Demo data would be reset (dev only)')
                }}
              >
                Reset Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Organization Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="font-semibold text-red-700">Delete Organization</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              This will permanently delete <strong>{ORG_NAME}</strong> and all associated data.
              This action is <strong>irreversible</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type <strong>{ORG_NAME}</strong> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={ORG_NAME}
                className="border-red-300"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText('') }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmText !== ORG_NAME}
                onClick={() => {
                  setShowDeleteDialog(false)
                  alert('Organization deletion would be triggered (requires backend confirmation)')
                }}
              >
                Delete Forever
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
