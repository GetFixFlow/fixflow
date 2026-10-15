import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useLocalization, useUpdateLocalization } from '@/hooks/useSettings'
import { CURRENCIES, DATE_PATTERNS, NUMBER_STYLES, formattersFor, type LocaleSettings } from '@/lib/localeFormat'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Colombo', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland',
]

const NUMBER_LABELS: Record<string, string> = {
  '1,234.56': 'comma thousands, period decimal',
  '1.234,56': 'period thousands, comma decimal',
  '1 234.56': 'space thousands, period decimal',
  '1 234,56': 'space thousands, comma decimal',
}

const selectClass = 'h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm'

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

function LocalizationForm({ saved }: { saved: LocaleSettings }) {
  const update = useUpdateLocalization()
  const [settings, setSettings] = useState<LocaleSettings>(saved)
  const set = (changes: Partial<LocaleSettings>) => setSettings((s) => ({ ...s, ...changes }))

  // The preview uses the very code the rest of the app uses, with the values in the form.
  const fmt = formattersFor(settings)
  const sample = new Date()
  const timezones = TIMEZONES.includes(settings.timezone) ? TIMEZONES : [settings.timezone, ...TIMEZONES]
  const unchanged = JSON.stringify(settings) === JSON.stringify(saved)

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Localization" description="How dates, times, numbers and money are shown to everyone" />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="loc-date" label="Date format">
              <select id="loc-date" value={settings.date_format} onChange={(e) => set({ date_format: e.target.value })} className={selectClass}>
                {Object.keys(DATE_PATTERNS).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field id="loc-time" label="Time format">
              <select id="loc-time" value={settings.time_format} onChange={(e) => set({ time_format: e.target.value as LocaleSettings['time_format'] })} className={selectClass}>
                <option value="12h">12-hour (3:30 PM)</option>
                <option value="24h">24-hour (15:30)</option>
              </select>
            </Field>
            <Field id="loc-currency" label="Currency">
              <select id="loc-currency" value={settings.currency} onChange={(e) => set({ currency: e.target.value })} className={selectClass}>
                {Object.entries(CURRENCIES).map(([code, c]) => <option key={code} value={code}>{code} — {c.name} ({c.symbol.trim()})</option>)}
              </select>
            </Field>
            <Field id="loc-number" label="Number format">
              <select id="loc-number" value={settings.number_format} onChange={(e) => set({ number_format: e.target.value })} className={selectClass}>
                {Object.keys(NUMBER_STYLES).map((f) => <option key={f} value={f}>{f} ({NUMBER_LABELS[f]})</option>)}
              </select>
            </Field>
            <Field id="loc-week" label="First day of the week">
              <select id="loc-week" value={settings.first_day_of_week} onChange={(e) => set({ first_day_of_week: e.target.value as LocaleSettings['first_day_of_week'] })} className={selectClass}>
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </Field>
            <Field id="loc-tz" label="Time zone">
              <select id="loc-tz" value={settings.timezone} onChange={(e) => set({ timezone: e.target.value })} className={selectClass}>
                {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-gray-500">
            The time zone is the one in Company settings, and is used for schedules such as when preventive maintenance falls due.
            Dates and times are shown in each person&apos;s own device time.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Preview</h3>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-gray-500">Date</dt><dd data-testid="preview-date">{fmt.date(sample)}</dd>
            <dt className="text-gray-500">Date and time</dt><dd data-testid="preview-datetime">{fmt.dateTime(sample)}</dd>
            <dt className="text-gray-500">Amount</dt><dd data-testid="preview-money">{fmt.money(1234.5)}</dd>
            <dt className="text-gray-500">Large number</dt><dd data-testid="preview-number">{fmt.number(1234567)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Button onClick={() => update.mutate(settings)} disabled={update.isPending || unchanged}>
        {update.isPending ? 'Saving…' : 'Save localization'}
      </Button>
    </div>
  )
}

export function LocalizationPage() {
  const { user } = useAuthStore()
  const { data, isLoading, isError, refetch } = useLocalization()

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Localization" description="Regional settings" />
        <Card><CardContent className="p-8 text-center"><p className="text-gray-500">Access Denied. Only administrators can manage localization settings.</p></CardContent></Card>
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Localization" description="How dates, times, numbers and money are shown to everyone" />
        <Card><CardContent className="p-6 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</CardContent></Card>
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Localization" description="How dates, times, numbers and money are shown to everyone" />
        <Card><CardContent className="p-8 text-center space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">The localization settings could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </CardContent></Card>
      </div>
    )
  }
  // Keyed on what is saved, so the form starts again from the server's answer after a save.
  return <LocalizationForm key={JSON.stringify(data)} saved={data} />
}
