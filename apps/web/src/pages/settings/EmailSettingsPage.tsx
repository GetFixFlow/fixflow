import { useState } from 'react'
import { Eye, EyeOff, CheckCircle, AlertCircle, ChevronDown, Info } from 'lucide-react'
import type { AxiosError } from 'axios'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useEmailSettings, useUpdateEmailSettings, useRemoveEmailSettings, useTestEmail } from '@/hooks/useSettings'
import type { EmailStatus, SmtpSettings } from '@/api/settings'

const EMAIL_TEMPLATES = [
  { id: 'work_order_assigned', name: 'Work Order Assigned', subject: 'Work Order #{number} Assigned to You' },
  { id: 'work_order_completed', name: 'Work Order Completed', subject: 'Work Order #{number} Completed' },
  { id: 'pm_reminder', name: 'PM Reminder', subject: 'Preventive Maintenance Due: {title}' },
  { id: 'invitation', name: 'User Invitation', subject: 'You have been invited to FixFlow' },
  { id: 'password_reset', name: 'Password Reset', subject: 'Reset your FixFlow password' },
  { id: 'daily_digest', name: 'Daily Digest', subject: 'FixFlow Daily Summary - {date}' },
  { id: 'weekly_report', name: 'Weekly Report', subject: 'FixFlow Weekly Report - Week {week}' },
]

/** Settings that usually work for the common providers. The person still adds their own username and password. */
const PRESETS: { name: string; fill: Partial<SmtpSettings>; hint: string }[] = [
  { name: 'Microsoft 365', fill: { host: 'smtp.office365.com', port: 587, encryption: 'tls' }, hint: 'Sign in with a mailbox that has SMTP AUTH enabled. The sender must be that mailbox.' },
  { name: 'Gmail', fill: { host: 'smtp.gmail.com', port: 587, encryption: 'tls' }, hint: 'Use an app password (Google account, Security, 2-Step Verification), not your normal password.' },
  { name: 'Mail server on your network', fill: { host: '', port: 25, encryption: 'none', username: '' }, hint: 'Enter its address. Many internal servers need no username or password.' },
]

type TestResult = { ok: boolean; message: string }

function formFrom(status: EmailStatus): SmtpSettings {
  return {
    host: status.host,
    port: status.port,
    username: status.username,
    password: '',
    from_address: status.from_address,
    from_name: status.from_name,
    encryption: status.encryption,
  }
}

function problemWith(form: SmtpSettings): string | null {
  if (!form.host.trim()) return 'Enter the mail server address.'
  if (!Number.isInteger(form.port) || form.port < 1 || form.port > 65535) return 'Enter a port between 1 and 65535.'
  if (!form.from_address.trim()) return 'Enter the address emails are sent from.'
  return null
}

const serverMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ error?: { message?: string } }>).response?.data?.error?.message ?? fallback

function EmailForm({ status }: { status: EmailStatus }) {
  const updateEmail = useUpdateEmailSettings()
  const removeEmail = useRemoveEmailSettings()
  const testEmail = useTestEmail()
  const [smtp, setSmtp] = useState<SmtpSettings>(() => formFrom(status))
  const [showPassword, setShowPassword] = useState(false)
  const [preset, setPreset] = useState<string | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const problem = problemWith(smtp)
  const set = (changes: Partial<SmtpSettings>) => {
    setSmtp((s) => ({ ...s, ...changes }))
    setResult(null)
  }

  const send = () =>
    testEmail.mutate(smtp, {
      onSuccess: (r) => setResult({ ok: true, message: r.data.message }),
      onError: (e) => setResult({ ok: false, message: serverMessage(e, 'The test email could not be sent.') }),
    })

  const remove = () => {
    if (!confirm('Remove the settings saved here? Email will use the server\'s own settings (if any).')) return
    removeEmail.mutate(undefined, { onSuccess: () => setSmtp(formFrom({ ...status, host: '', username: '', from_address: '', from_name: '' })) })
  }

  const templateContent = selectedTemplate ? `
<!DOCTYPE html>
<html>
<head><title>Email Preview</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">FixFlow</h1>
  </div>
  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; color: #111827;">${EMAIL_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}</h2>
    <p style="color: #6b7280;">This is a preview of the <strong>${EMAIL_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}</strong> email template.</p>
    <p style="color: #6b7280;">Dynamic content like work order numbers, due dates, and user names will be filled in when the email is sent.</p>
    <div style="margin-top: 20px;">
      <a href="#" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">View in FixFlow</a>
    </div>
  </div>
  <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">You're receiving this email from FixFlow CMMS. Manage your preferences in Settings.</p>
</body>
</html>` : null

  const fromSettings = status.source === 'settings'
  const fromEnvironment = status.source === 'environment'

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Email Settings" description="The mail server FixFlow sends email through" />

      {/* Status Banner */}
      <div className={`flex items-center gap-3 rounded-lg p-3 border ${
        status.configured
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
          : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
      }`}>
        {status.configured ? (
          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-medium ${status.configured ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {fromSettings && `Email is set up: sending through ${status.host}`}
            {fromEnvironment && `Email is set up on the server (${status.environment_host})`}
            {!status.configured && 'Email is not set up'}
          </p>
          <p className="text-xs text-gray-500">
            {fromSettings && 'Using the settings saved below.'}
            {fromEnvironment && 'Settings saved below would take over from it.'}
            {!status.configured && 'Until it is, invitations and password resets give you a link to copy and send yourself.'}
          </p>
        </div>
      </div>

      {/* SMTP Form */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mail server</h3>

          <div>
            <p className="mb-1.5 text-xs text-gray-500">Fill in common settings:</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.name}
                  type="button"
                  size="sm"
                  variant={preset === p.name ? 'default' : 'outline'}
                  onClick={() => { setPreset(p.name); set(p.fill) }}
                >
                  {p.name}
                </Button>
              ))}
            </div>
            {preset && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {PRESETS.find((p) => p.name === preset)?.hint}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input id="smtp-host" label="Server address" value={smtp.host} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.example.com" />
            </div>
            <Input
              id="smtp-port"
              label="Port"
              type="number"
              value={Number.isNaN(smtp.port) ? '' : smtp.port}
              onChange={(e) => set({ port: parseInt(e.target.value, 10) })}
            />
            <div>
              <label htmlFor="smtp-encryption" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Encryption</label>
              <select
                id="smtp-encryption"
                value={smtp.encryption}
                onChange={(e) => set({ encryption: e.target.value as SmtpSettings['encryption'] })}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                <option value="tls">STARTTLS (usually port 587)</option>
                <option value="ssl">SSL/TLS (usually port 465)</option>
                <option value="none">None (usually port 25)</option>
              </select>
            </div>
            <Input id="smtp-username" label="Username" value={smtp.username} onChange={(e) => set({ username: e.target.value })} placeholder="Leave empty if the server needs none" autoComplete="off" />
            <div>
              <label htmlFor="smtp-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Input
                  id="smtp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={smtp.password}
                  onChange={(e) => set({ password: e.target.value })}
                  placeholder={status.password_set ? 'Saved. Leave empty to keep it' : ''}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-gray-400"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Input id="smtp-from-name" label="Sender name" value={smtp.from_name} onChange={(e) => set({ from_name: e.target.value })} placeholder="Acme Maintenance" />
            <Input id="smtp-from-address" label="Sender address" type="email" value={smtp.from_address} onChange={(e) => set({ from_address: e.target.value })} placeholder="maintenance@yourcompany.com" />
          </div>

          {result && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                result.ok
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/10 dark:text-green-300'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/10 dark:text-red-300'
              }`}
            >
              {result.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => updateEmail.mutate(smtp, { onSuccess: () => set({ password: '' }) })} disabled={updateEmail.isPending || !!problem}>
              {updateEmail.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" onClick={send} disabled={testEmail.isPending || !!problem}>
              {testEmail.isPending ? 'Sending…' : 'Send me a test email'}
            </Button>
            {fromSettings && (
              <Button variant="ghost" onClick={remove} disabled={removeEmail.isPending}>
                Remove saved settings
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            The test goes to your own address using what is in the form, without saving it. Saved settings are used for every email, ahead of the server&apos;s own.
          </p>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Email Templates</h3>
          <p className="text-sm text-gray-500">Preview the email templates sent by FixFlow.</p>

          <div>
            <select
              value={selectedTemplate ?? ''}
              onChange={(e) => setSelectedTemplate(e.target.value || null)}
              className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
            >
              <option value="">Select a template to preview…</option>
              {EMAIL_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {selectedTemplate && templateContent && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ChevronDown className="h-3 w-3" />
                <span>Subject: {EMAIL_TEMPLATES.find((t) => t.id === selectedTemplate)?.subject}</span>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={templateContent}
                  title="Email Template Preview"
                  className="w-full h-72 bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function EmailSettingsPage() {
  const { user } = useAuthStore()
  const { data: status, isLoading, isError, refetch } = useEmailSettings()

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Email Settings" description="Configure outgoing email" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can manage email settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Email Settings" description="The mail server FixFlow sends email through" />
        <Card><CardContent className="p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  if (isError || !status) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Email Settings" description="The mail server FixFlow sends email through" />
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">The email settings could not be loaded.</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Keyed on what is saved, so the form starts again from the server's answer after a save or removal.
  return <EmailForm key={`${status.source}-${status.host}-${status.password_set}`} status={status} />
}
