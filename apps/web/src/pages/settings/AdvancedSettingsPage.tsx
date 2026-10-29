import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
  const { data: settings, isLoading, isError } = useOrgSettings()
  const save = useUpdateOrgSettings()
  const [copied, setCopied] = useState(false)

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Advanced Settings" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Only administrators can change advanced settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formOpen = settings?.public_requests_enabled ?? true
  const formAddress = `${window.location.origin}/request`

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(formAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false) // the address is on the page to copy by hand
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Advanced Settings" description="Settings that change how FixFlow behaves for people outside your team" />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Public request form</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Anyone with the address, or who scans an asset&apos;s QR label, can report a problem without an account. Each request
                becomes a work order and your managers are told.
              </p>
            </div>
            <Toggle
              label="Accept requests from people with no account"
              checked={formOpen}
              disabled={isLoading || isError || save.isPending}
              onChange={(open) => save.mutate({ public_requests_enabled: open })}
            />
          </div>

          {isError ? (
            <p role="alert" className="text-sm text-red-600">Could not load this setting, so it cannot be changed now. Reload the page to try again.</p>
          ) : (
            <p role="status" className={cn('text-sm', formOpen ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400')}>
              {formOpen
                ? 'On: the form takes requests.'
                : 'Off: the form refuses new requests and tells people to contact your maintenance team. Links people already have still show how their request is going.'}
            </p>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">Address of the form</p>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
              <code className="flex-1 truncate font-mono text-xs text-gray-600 dark:text-gray-400">{formAddress}</code>
              <button type="button" onClick={copyAddress} aria-label="Copy the address" className="shrink-0 text-gray-400 hover:text-gray-600">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              An asset&apos;s own QR label (Assets, then the QR Code action on its row) opens this form with that asset already chosen.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Two-factor sign-in</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                When this is on, everyone in the company must sign in with an authenticator app as well as their password. A person
                who has not set it up is taken to do so first, and can do nothing else until they have. Anyone can already set it up
                for themselves under Settings, Security.
              </p>
            </div>
            <Toggle
              label="Require two-factor sign-in for everyone"
              checked={settings?.require_two_factor ?? false}
              disabled={isLoading || isError || save.isPending}
              onChange={(required) => save.mutate({ require_two_factor: required })}
            />
          </div>
          {!isError && (
            <p className={cn('text-sm', settings?.require_two_factor ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400')}>
              {settings?.require_two_factor
                ? 'On: everyone needs an authenticator app. If someone loses their phone, reset their two-factor under Settings, Users.'
                : 'Off: each person chooses whether to use it.'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">System health</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              The version, the database, Redis, the background worker, email, IoT and storage, checked live, and whether a newer release exists.
            </p>
          </div>
          <Link to="/settings/system-health" className="shrink-0 text-sm text-brand-600 hover:underline">Open System Health →</Link>
        </CardContent>
      </Card>
    </div>
  )
}
