import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useLocalization, useUpdateLocalization } from '@/hooks/useSettings'
import { LANGUAGES } from '@/i18n'
import { CURRENCIES, DATE_PATTERNS, NUMBER_STYLES, formattersFor, type LocaleSettings } from '@/lib/localeFormat'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Colombo', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland',
]

/** The key of the description of each number style in the translations. */
const NUMBER_LABELS: Record<string, string> = {
  '1,234.56': 'settings.localization.number_comma_period',
  '1.234,56': 'settings.localization.number_period_comma',
  '1 234.56': 'settings.localization.number_space_period',
  '1 234,56': 'settings.localization.number_space_comma',
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
  const { t } = useTranslation()
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
      <PageHeader title={t('settings.localization.title')} description={t('settings.localization.description')} />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="loc-language" label={t('language.label')}>
              <select id="loc-language" value={settings.language} onChange={(e) => set({ language: e.target.value })} className={selectClass}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </Field>
            <Field id="loc-date" label={t('settings.localization.date_format')}>
              <select id="loc-date" value={settings.date_format} onChange={(e) => set({ date_format: e.target.value })} className={selectClass}>
                {Object.keys(DATE_PATTERNS).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field id="loc-time" label={t('settings.localization.time_format')}>
              <select id="loc-time" value={settings.time_format} onChange={(e) => set({ time_format: e.target.value as LocaleSettings['time_format'] })} className={selectClass}>
                <option value="12h">{t('settings.localization.time_12h')}</option>
                <option value="24h">{t('settings.localization.time_24h')}</option>
              </select>
            </Field>
            <Field id="loc-currency" label={t('settings.localization.currency')}>
              <select id="loc-currency" value={settings.currency} onChange={(e) => set({ currency: e.target.value })} className={selectClass}>
                {Object.entries(CURRENCIES).map(([code, c]) => <option key={code} value={code}>{code} — {c.name} ({c.symbol.trim()})</option>)}
              </select>
            </Field>
            <Field id="loc-number" label={t('settings.localization.number_format')}>
              <select id="loc-number" value={settings.number_format} onChange={(e) => set({ number_format: e.target.value })} className={selectClass}>
                {Object.keys(NUMBER_STYLES).map((f) => <option key={f} value={f}>{f} ({t(NUMBER_LABELS[f])})</option>)}
              </select>
            </Field>
            <Field id="loc-week" label={t('settings.localization.first_day')}>
              <select id="loc-week" value={settings.first_day_of_week} onChange={(e) => set({ first_day_of_week: e.target.value as LocaleSettings['first_day_of_week'] })} className={selectClass}>
                <option value="monday">{t('settings.localization.monday')}</option>
                <option value="sunday">{t('settings.localization.sunday')}</option>
              </select>
            </Field>
            <Field id="loc-tz" label={t('settings.localization.time_zone')}>
              <select id="loc-tz" value={settings.timezone} onChange={(e) => set({ timezone: e.target.value })} className={selectClass}>
                {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('settings.localization.time_zone_note')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('settings.localization.preview')}</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">{t('settings.localization.preview_date')}</dt><dd data-testid="preview-date">{fmt.date(sample)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">{t('settings.localization.preview_datetime')}</dt><dd data-testid="preview-datetime">{fmt.dateTime(sample)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">{t('settings.localization.preview_amount')}</dt><dd data-testid="preview-money">{fmt.money(1234.5)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">{t('settings.localization.preview_number')}</dt><dd data-testid="preview-number">{fmt.number(1234567)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Button onClick={() => update.mutate(settings)} disabled={update.isPending || unchanged}>
        {update.isPending ? t('common.actions.saving') : t('settings.localization.save')}
      </Button>
    </div>
  )
}

export function LocalizationPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { data, isLoading, isError, refetch } = useLocalization()

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title={t('settings.localization.title')} description={t('settings.localization.regional')} />
        <Card><CardContent className="p-8 text-center"><p className="text-gray-500 dark:text-gray-400">{t('settings.localization.denied')}</p></CardContent></Card>
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title={t('settings.localization.title')} description={t('settings.localization.description')} />
        <Card><CardContent className="p-6 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</CardContent></Card>
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title={t('settings.localization.title')} description={t('settings.localization.description')} />
        <Card><CardContent className="p-8 text-center space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('settings.localization.load_failed')}</p>
          <Button variant="outline" onClick={() => refetch()}>{t('common.actions.retry')}</Button>
        </CardContent></Card>
      </div>
    )
  }
  // Keyed on what is saved, so the form starts again from the server's answer after a save.
  return <LocalizationForm key={JSON.stringify(data)} saved={data} />
}
