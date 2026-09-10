import { useState } from 'react'
import { Eye, EyeOff, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useEmailSettings, useUpdateEmailSettings, useTestEmail } from '@/hooks/useSettings'
import type { SmtpSettings } from '@/api/settings'

const EMAIL_TEMPLATES = [
  { id: 'work_order_assigned', name: 'Work Order Assigned', subject: 'Work Order #{number} Assigned to You' },
  { id: 'work_order_completed', name: 'Work Order Completed', subject: 'Work Order #{number} Completed' },
  { id: 'pm_reminder', name: 'PM Reminder', subject: 'Preventive Maintenance Due: {title}' },
  { id: 'invitation', name: 'User Invitation', subject: 'You have been invited to FixFlow' },
  { id: 'password_reset', name: 'Password Reset', subject: 'Reset your FixFlow password' },
  { id: 'daily_digest', name: 'Daily Digest', subject: 'FixFlow Daily Summary - {date}' },
  { id: 'weekly_report', name: 'Weekly Report', subject: 'FixFlow Weekly Report - Week {week}' },
]

const DEFAULT_SMTP: Partial<SmtpSettings> = {
  host: '',
  port: 587,
  username: '',
  password: '',
  from_address: '',
  from_name: '',
  encryption: 'tls',
  configured: false,
}

export function EmailSettingsPage() {
  const { user } = useAuthStore()
  const { data: serverSmtp, isLoading } = useEmailSettings()
  const updateEmail = useUpdateEmailSettings()
  const testEmail = useTestEmail()

  const [smtp, setSmtp] = useState<Partial<SmtpSettings>>({ ...DEFAULT_SMTP, ...serverSmtp })
  const [showPassword, setShowPassword] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

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
        <PageHeader title="Email Settings" description="Configure SMTP settings for outgoing email" />
        <Card><CardContent className="p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  const isConfigured = serverSmtp?.configured

  const handleSave = () => {
    updateEmail.mutate(smtp as SmtpSettings)
  }

  const handleTest = () => {
    testEmail.mutate(undefined)
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

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Email Settings" description="Configure SMTP settings for outgoing email" />

      {/* Status Banner */}
      <div className={`flex items-center gap-3 rounded-lg p-3 border ${
        isConfigured
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
          : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
      }`}>
        {isConfigured ? (
          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-medium ${isConfigured ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {isConfigured ? 'Email is configured and active' : 'Email is not configured'}
          </p>
          <p className="text-xs text-gray-500">
            {isConfigured
              ? `Sending from ${serverSmtp?.from_address}`
              : 'Configure SMTP settings below to enable email notifications'}
          </p>
        </div>
      </div>

      {/* SMTP Form */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">SMTP Configuration</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Host</label>
              <Input
                value={smtp.host ?? ''}
                onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
              <Input
                type="number"
                value={smtp.port ?? 587}
                onChange={(e) => setSmtp((s) => ({ ...s, port: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Encryption</label>
              <select
                value={smtp.encryption ?? 'tls'}
                onChange={(e) => setSmtp((s) => ({ ...s, encryption: e.target.value as SmtpSettings['encryption'] }))}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                <option value="none">None</option>
                <option value="tls">STARTTLS</option>
                <option value="ssl">SSL/TLS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <Input
                value={smtp.username ?? ''}
                onChange={(e) => setSmtp((s) => ({ ...s, username: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={smtp.password ?? ''}
                  onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-gray-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Name</label>
              <Input
                value={smtp.from_name ?? ''}
                onChange={(e) => setSmtp((s) => ({ ...s, from_name: e.target.value }))}
                placeholder="FixFlow CMMS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Address</label>
              <Input
                type="email"
                value={smtp.from_address ?? ''}
                onChange={(e) => setSmtp((s) => ({ ...s, from_address: e.target.value }))}
                placeholder="noreply@yourcompany.com"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={updateEmail.isPending}>
              {updateEmail.isPending ? 'Saving…' : 'Save Email Settings'}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testEmail.isPending || !isConfigured}
            >
              {testEmail.isPending ? 'Sending…' : 'Test Email Configuration'}
            </Button>
          </div>
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
