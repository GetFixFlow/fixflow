import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useLocalization, useUpdateLocalization } from '@/hooks/useSettings'
import type { LocalizationSettings } from '@/api/settings'

const LANGUAGES = [
  { value: 'en', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
]

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
  { value: 'MMM D, YYYY', label: 'MMM D, YYYY' },
]

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Colombo',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
]

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — British Pound (£)' },
  { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { value: 'CAD', label: 'CAD — Canadian Dollar (CA$)' },
  { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { value: 'CHF', label: 'CHF — Swiss Franc (Fr)' },
  { value: 'INR', label: 'INR — Indian Rupee (₹)' },
  { value: 'LKR', label: 'LKR — Sri Lankan Rupee (₨)' },
  { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
]

const NUMBER_FORMATS = [
  { value: '1,234.56', label: '1,234.56 (comma thousands, period decimal)' },
  { value: '1.234,56', label: '1.234,56 (period thousands, comma decimal)' },
  { value: '1 234.56', label: '1 234.56 (space thousands, period decimal)' },
  { value: '1 234,56', label: '1 234,56 (space thousands, comma decimal)' },
]

const DEFAULT_LOCALIZATION: LocalizationSettings = {
  language: 'en',
  date_format: 'MM/DD/YYYY',
  time_format: '12h',
  timezone: 'UTC',
  currency: 'USD',
  first_day_of_week: 'monday',
  number_format: '1,234.56',
}

function formatPreviewDate(format: string): string {
  const now = new Date()
  const d = String(now.getDate()).padStart(2, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const y = now.getFullYear()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[now.getMonth()]

  switch (format) {
    case 'MM/DD/YYYY': return `${m}/${d}/${y}`
    case 'DD/MM/YYYY': return `${d}/${m}/${y}`
    case 'YYYY-MM-DD': return `${y}-${m}-${d}`
    case 'DD MMM YYYY': return `${d} ${mon} ${y}`
    case 'MMM D, YYYY': return `${mon} ${now.getDate()}, ${y}`
    default: return `${m}/${d}/${y}`
  }
}

function formatPreviewTime(format: '12h' | '24h'): string {
  const now = new Date()
  const h24 = now.getHours()
  const min = String(now.getMinutes()).padStart(2, '0')
  if (format === '24h') return `${String(h24).padStart(2, '0')}:${min}`
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12
  return `${h12}:${min} ${ampm}`
}

function formatPreviewNumber(format: string, currency: string): string {
  const currencies: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$',
    CHF: 'Fr', INR: '₹', LKR: '₨', SGD: 'S$',
  }
  const symbol = currencies[currency] ?? '$'
  return `${symbol}${format === '1.234,56' ? '1.234,56' : format === '1 234.56' ? '1 234.56' : format === '1 234,56' ? '1 234,56' : '1,234.56'}`
}

export function LocalizationPage() {
  const { user } = useAuthStore()
  const { data: serverLocalization, isLoading } = useLocalization()
  const updateLocalization = useUpdateLocalization()

  const [settings, setSettings] = useState<LocalizationSettings>({
    ...DEFAULT_LOCALIZATION,
    ...serverLocalization,
  })

  const [tzSearch, setTzSearch] = useState('')

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Localization" description="Regional settings" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can manage localization settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Localization" description="Configure regional and display settings" />
        <Card><CardContent className="p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  const filteredTz = TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(tzSearch.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Localization" description="Configure regional and display settings" />

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Regional Settings</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            {/* First Day of Week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Day of Week
              </label>
              <select
                value={settings.first_day_of_week}
                onChange={(e) => setSettings((s) => ({ ...s, first_day_of_week: e.target.value as LocalizationSettings['first_day_of_week'] }))}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>

            {/* Date Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Format
              </label>
              <select
                value={settings.date_format}
                onChange={(e) => setSettings((s) => ({ ...s, date_format: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            {/* Time Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time Format
              </label>
              <select
                value={settings.time_format}
                onChange={(e) => setSettings((s) => ({ ...s, time_format: e.target.value as LocalizationSettings['time_format'] }))}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                <option value="12h">12-hour (3:30 PM)</option>
                <option value="24h">24-hour (15:30)</option>
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Number Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number Format
              </label>
              <select
                value={settings.number_format}
                onChange={(e) => setSettings((s) => ({ ...s, number_format: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            {/* Timezone (searchable) */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timezone
              </label>
              <input
                type="text"
                placeholder="Search timezone…"
                value={tzSearch}
                onChange={(e) => setTzSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm mb-1"
              />
              <select
                value={settings.timezone}
                onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                size={4}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1 text-sm"
              >
                {filteredTz.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Preview</h3>
          <p className="text-xs text-gray-400">How dates, times, and numbers will appear across FixFlow:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Date</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatPreviewDate(settings.date_format)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Time</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatPreviewTime(settings.time_format)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Currency</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatPreviewNumber(settings.number_format, settings.currency)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Timezone</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {settings.timezone}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => updateLocalization.mutate(settings)} disabled={updateLocalization.isPending}>
        {updateLocalization.isPending ? 'Saving…' : 'Save Localization'}
      </Button>
    </div>
  )
}
