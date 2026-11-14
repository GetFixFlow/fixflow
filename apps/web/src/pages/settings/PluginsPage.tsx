import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { AlertTriangle, CheckCircle, AlertCircle, FileBarChart } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  usePlugins, useRemovePluginChannel, useSavePluginChannel, useSetPluginEnabled, useTestPluginChannel,
} from '@/hooks/usePlugins'
import { formatDateTime } from '@/lib/localeFormat'
import type { Plugin, PluginChannel, PluginField } from '@/api/plugins'

const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800'
const HELP = 'mt-1 text-xs text-gray-500 dark:text-gray-400'

type Result = { ok: boolean; message: string }

const serverMessage = (error: unknown) => (error as AxiosError<{ error?: { message?: string } }> | null)?.response?.data?.error?.message ?? null

/** One input of a channel's form, drawn from what the plugin said about the field. */
function FieldInput({
  id, field, value, secretSet, onChange,
}: { id: string; field: PluginField; value: string; secretSet: boolean; onChange: (value: string) => void }) {
  const { t } = useTranslation()

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {field.label}
      </label>
      {field.kind === 'select' ? (
        <select id={id} value={value || field.default || ''} onChange={(e) => onChange(e.target.value)} className={FIELD}>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          type={field.kind === 'secret' ? 'password' : 'text'}
          autoComplete="off"
          value={value}
          placeholder={field.kind === 'secret' && secretSet ? t('plugins.channel.secret_saved') : (field.default ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {(field.help || field.kind === 'secret') && (
        <p className={HELP}>{[field.help, field.kind === 'secret' ? t('plugins.channel.secret_note') : ''].filter(Boolean).join(' ')}</p>
      )}
    </div>
  )
}

/** How this company has set up one notification channel of a plugin. */
function ChannelForm({ plugin, channel, events }: { plugin: Plugin; channel: PluginChannel; events: { key: string; label: string }[] }) {
  const { t } = useTranslation()
  const save = useSavePluginChannel()
  const remove = useRemovePluginChannel()
  const test = useTestPluginChannel()
  const [enabled, setEnabled] = useState(channel.enabled)
  const [selected, setSelected] = useState(channel.events)
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(channel.fields.map((f) => [f.key, ''])),
    ...channel.values,
  }))
  const [result, setResult] = useState<Result | null>(null)
  const idFor = (field: PluginField) => `${plugin.key}-${channel.key}-${field.key}`

  const change = (apply: () => void) => {
    apply()
    setResult(null)
  }
  const toggleEvent = (key: string, on: boolean) =>
    change(() => setSelected((list) => (on ? [...list, key] : list.filter((e) => e !== key))))

  const missing = channel.fields.find((f) => f.required && (f.kind === 'secret' ? !channel.secrets_set[f.key] && !values[f.key]?.trim() : !values[f.key]?.trim() && !f.default))
  const problem = enabled && missing ? t('plugins.channel.needs', { field: missing.label }) : null

  const sendTest = () =>
    test.mutate(
      { key: plugin.key, channel: channel.key, values },
      {
        onSuccess: (r) => setResult({ ok: true, message: r.message }),
        onError: (e) => setResult({ ok: false, message: serverMessage(e) ?? t('plugins.channel.test_failed') }),
      },
    )

  const saveChannel = () =>
    save.mutate(
      { key: plugin.key, channel: channel.key, form: { enabled, events: selected, values } },
      { onSuccess: () => setValues((v) => ({ ...v, ...Object.fromEntries(channel.fields.filter((f) => f.kind === 'secret').map((f) => [f.key, ''])) })) },
    )

  const forget = () => {
    if (!confirm(t('plugins.channel.remove_confirm', { name: channel.title }))) return
    remove.mutate(
      { key: plugin.key, channel: channel.key },
      {
        onSuccess: () => {
          setEnabled(false)
          setValues(Object.fromEntries(channel.fields.map((f) => [f.key, ''])))
        },
      },
    )
  }

  const going = channel.enabled && !channel.last_error
  return (
    <section aria-label={channel.title} className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{channel.title}</h4>
        {channel.summary && <p className={HELP}>{channel.summary}</p>}
      </div>

      <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        {going ? <CheckCircle aria-hidden="true" className="h-4 w-4 text-green-700 dark:text-green-400" /> : <AlertCircle aria-hidden="true" className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
        {channel.enabled ? t('plugins.channel.on') : t('plugins.channel.off')}
        {channel.last_sent_at && <span>{t('plugins.channel.last_sent', { when: formatDateTime(channel.last_sent_at) })}</span>}
      </p>
      {channel.last_error && (
        <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          {t('plugins.channel.last_error', { error: channel.last_error })}
        </p>
      )}

      {channel.fields.map((field) => (
        <FieldInput
          key={field.key}
          id={idFor(field)}
          field={field}
          value={values[field.key] ?? ''}
          secretSet={!!channel.secrets_set[field.key]}
          onChange={(value) => change(() => setValues((v) => ({ ...v, [field.key]: value })))}
        />
      ))}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t('plugins.channel.events')}</legend>
        <div className="space-y-1.5">
          {events.map((event) => (
            <label key={event.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded" checked={selected.includes(event.key)} onChange={(e) => toggleEvent(event.key, e.target.checked)} />
              {event.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <input type="checkbox" className="rounded" checked={enabled} onChange={(e) => change(() => setEnabled(e.target.checked))} />
        {t('plugins.channel.enabled')}
      </label>
      {problem && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{problem}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={saveChannel} disabled={!!problem || save.isPending}>
          {save.isPending ? t('plugins.channel.saving') : t('plugins.channel.save')}
        </Button>
        <Button variant="outline" onClick={sendTest} disabled={test.isPending}>
          {test.isPending ? t('plugins.channel.testing') : t('plugins.channel.test')}
        </Button>
        <Button
          variant="ghost" onClick={forget} disabled={remove.isPending} className="text-red-600 dark:text-red-400"
          aria-label={t('plugins.channel.remove_aria', { name: channel.title })}
        >
          {t('plugins.channel.remove')}
        </Button>
      </div>
      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={`text-sm ${result.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
          {result.message}
        </p>
      )}
    </section>
  )
}

function PluginCard({ plugin, events }: { plugin: Plugin; events: { key: string; label: string }[] }) {
  const { t } = useTranslation()
  const toggle = useSetPluginEnabled()

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{plugin.title}</h2>
              <Badge variant={plugin.enabled ? 'success' : 'secondary'}>{plugin.enabled ? t('plugins.card.on') : t('plugins.card.off')}</Badge>
            </div>
            {plugin.summary && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{plugin.summary}</p>}
            <p className={HELP}>
              {[
                plugin.version ? t('plugins.card.version', { version: plugin.version }) : '',
                plugin.author ? t('plugins.card.author', { author: plugin.author }) : '',
                plugin.folder ? t('plugins.card.folder', { folder: plugin.folder }) : '',
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Button
            variant={plugin.enabled ? 'outline' : 'default'}
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ key: plugin.key, enabled: !plugin.enabled })}
            aria-label={t(plugin.enabled ? 'plugins.card.switch_off_aria' : 'plugins.card.switch_on_aria', { name: plugin.title })}
          >
            {t(plugin.enabled ? 'plugins.card.switch_off' : 'plugins.card.switch_on')}
          </Button>
        </div>

        {!plugin.enabled && <p className="text-sm text-gray-500 dark:text-gray-400">{t('plugins.card.off_note')}</p>}

        {plugin.reports.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t('plugins.card.reports')}</h3>
            <ul className="space-y-1">
              {plugin.reports.map((report) => (
                <li key={report.key} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <FileBarChart aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>
                    {plugin.enabled ? (
                      <Link
                        to={`/reports/plugins/${plugin.key}/${report.key}`}
                        aria-label={t('plugins.card.open_report', { name: report.title })}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {report.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{report.title}</span>
                    )}
                    {report.description && <span className="text-gray-500 dark:text-gray-400"> — {report.description}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className={HELP}>{t('plugins.card.reports_where')}</p>
          </div>
        )}

        {plugin.enabled && plugin.channels.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('plugins.card.channels')}</h3>
            {plugin.channels.map((channel) => (
              <ChannelForm key={channel.key} plugin={plugin} channel={channel} events={events} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PluginsPage() {
  const { t } = useTranslation()
  const { data, isLoading, refetch } = usePlugins()

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('plugins.page.title')} description={t('plugins.page.description')} />
      <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">{t('plugins.page.note')}</p>

      {isLoading && <Skeleton className="h-48" />}

      {!isLoading && !data && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('plugins.page.load_failed')}</p>
          <Button variant="outline" onClick={() => refetch()}>{t('plugins.page.try_again')}</Button>
        </div>
      )}

      {data && data.failures.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            {t('plugins.failed.title')}
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{t('plugins.failed.intro')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
            {data.failures.map((failure) => (
              <li key={failure.folder}>{t('plugins.failed.item', { folder: failure.folder, message: failure.message })}</li>
            ))}
          </ul>
        </div>
      )}

      {data && data.plugins.length === 0 && data.failures.length === 0 && (
        <EmptyState title={t('plugins.page.empty_title')} description={t('plugins.page.empty_text')} />
      )}

      {data?.plugins.map((plugin) => (
        <PluginCard key={plugin.key} plugin={plugin} events={data.available_events} />
      ))}
    </div>
  )
}
