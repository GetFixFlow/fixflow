import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { Copy } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  useCreateWebhook, useEnableWebhook, useRedeliverWebhook, useRemoveWebhook, useRotateWebhookSecret, useTestWebhook,
  useUpdateWebhook, useWebhook, useWebhooks,
} from '@/hooks/useWebhooks'
import { currentLanguage } from '@/i18n'
import { timeAgo } from '@/lib/timeAgo'
import type { DeliveryStatus, Webhook, WebhookDelivery, WebhookEventOption } from '@/api/webhooks'

const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800'
const HELP = 'mt-1 text-xs text-gray-500 dark:text-gray-400'
const REFRESH_MS = 10_000

const SAMPLE_BODY = `{
  "id": "evt_5f0c1d52-...",
  "event": "work_order.completed",
  "created_at": "2026-11-11T10:30:00Z",
  "data": {
    "work_order": { "id": 41, "number": "WO-000041", "title": "Pump 3 is leaking", "status": "completed", ... }
  },
  "changes": { "status": ["in_progress", "completed"] }
}`

const serverMessage = (error: unknown) => (error as AxiosError<{ error?: { message?: string } }> | null)?.response?.data?.error?.message ?? null

const moment = (iso: string) => new Date(iso).toLocaleString(currentLanguage())

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false) // the secret is on the screen to select by hand
    }
  }
  return { copied, copy }
}

/** The signing secret, shown once. */
function SecretDialog({ name, secret, renewed, onClose }: { name: string; secret: string; renewed: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { copied, copy } = useCopy(secret)
  return (
    <Modal
      open
      onClose={onClose}
      title={renewed ? t('webhooks.secret.title_renewed') : t('webhooks.secret.title_created')}
      description={t('webhooks.secret.description', { name })}
    >
      <div className="space-y-4">
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          {t('webhooks.secret.warning')}
        </p>
        <div>
          <label htmlFor="webhook-secret" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('webhooks.secret.label')}</label>
          <div className="flex gap-2">
            <input id="webhook-secret" readOnly value={secret} className={`${FIELD} font-mono`} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" onClick={copy}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {copied ? t('webhooks.secret.copied') : t('webhooks.secret.copy')}
            </Button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>{t('webhooks.secret.done')}</Button>
        </div>
      </div>
    </Modal>
  )
}

interface FormProps {
  webhook: Webhook | null
  events: WebhookEventOption[]
  onClose: () => void
  onSecret: (name: string, secret: string) => void
}

function WebhookForm({ webhook, events, onClose, onSecret }: FormProps) {
  const { t } = useTranslation()
  const create = useCreateWebhook()
  const update = useUpdateWebhook()
  const [name, setName] = useState(webhook?.name ?? '')
  const [url, setUrl] = useState(webhook?.url ?? '')
  const [chosen, setChosen] = useState<string[]>(webhook?.events ?? [])
  const [active, setActive] = useState(webhook?.active ?? true)
  const mutation = webhook ? update : create
  const pending = mutation.isPending
  const noEvents = chosen.length === 0
  const message = mutation.isError ? serverMessage(mutation.error) ?? t('webhooks.form.save_failed') : null

  const toggle = (key: string) => setChosen((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]))

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (noEvents) return
    if (webhook) {
      update.mutate({ id: webhook.id, name: name.trim(), url: url.trim(), events: chosen, active }, { onSuccess: onClose })
    } else {
      create.mutate({ name: name.trim(), url: url.trim(), events: chosen }, {
        onSuccess: (data) => {
          onClose()
          onSecret(data.webhook.name, data.secret)
        },
      })
    }
  }

  return (
    <Modal open onClose={onClose} title={webhook ? t('webhooks.form.edit_title') : t('webhooks.form.add_title')} className="max-h-[90vh] max-w-xl overflow-y-auto">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Input id="webhook-name" label={t('webhooks.form.name')} value={name} onChange={(e) => setName(e.target.value)} required aria-describedby="webhook-name-help" />
          <p id="webhook-name-help" className={HELP}>{t('webhooks.form.name_help')}</p>
        </div>
        <div>
          <Input id="webhook-url" label={t('webhooks.form.url')} value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://" aria-describedby="webhook-url-help" />
          <p id="webhook-url-help" className={HELP}>{t('webhooks.form.url_help')}</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{t('webhooks.form.events')}</legend>
          <div className="flex gap-3 text-sm">
            <button type="button" className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => setChosen(events.map((e) => e.key))}>{t('webhooks.form.select_all')}</button>
            <button type="button" className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => setChosen([])}>{t('webhooks.form.select_none')}</button>
          </div>
          {events.map((option) => (
            <div key={option.key}>
              <label htmlFor={`webhook-event-${option.key}`} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input id={`webhook-event-${option.key}`} type="checkbox" className="mt-0.5 rounded" checked={chosen.includes(option.key)} onChange={() => toggle(option.key)} />
                <span>
                  {option.label} <code className="ml-1 text-xs text-gray-500 dark:text-gray-400">{option.key}</code>
                </span>
              </label>
            </div>
          ))}
          {noEvents && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{t('webhooks.form.pick_one')}</p>}
        </fieldset>
        {webhook && (
          <label htmlFor="webhook-active" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input id="webhook-active" type="checkbox" className="rounded" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('webhooks.form.active')}
          </label>
        )}
        {message && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('webhooks.form.cancel')}</Button>
          <Button type="submit" disabled={pending || noEvents}>{pending ? t('webhooks.form.saving') : t('webhooks.form.save')}</Button>
        </div>
      </form>
    </Modal>
  )
}

const STATUS_TEXT: Record<DeliveryStatus, string> = {
  delivered: 'webhooks.log.status_delivered',
  pending: 'webhooks.log.status_pending',
  failed: 'webhooks.log.status_failed',
}
const STATUS_VARIANT = { delivered: 'success', pending: 'warning', failed: 'destructive' } as const

function RecentMessages({ webhook }: { webhook: Webhook }) {
  const { t } = useTranslation()
  const { data, isLoading, refetch } = useWebhook(webhook.id)
  const again = useRedeliverWebhook()
  const deliveries: WebhookDelivery[] = data?.deliveries ?? []
  const waiting = deliveries.some((d) => d.status === 'pending')

  // Messages still being retried change by themselves: look again every few seconds while one is waiting.
  useEffect(() => {
    if (!waiting) return undefined
    const timer = setInterval(() => { void refetch() }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [waiting, refetch])

  return (
    <section aria-labelledby={`webhook-log-${webhook.id}`} className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h3 id={`webhook-log-${webhook.id}`} className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('webhooks.log.title')}</h3>
      {isLoading && <p className={HELP}>{t('webhooks.log.loading')}</p>}
      {!isLoading && deliveries.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('webhooks.log.empty')}</p>}
      {deliveries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500 dark:text-gray-400">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">{t('webhooks.log.time')}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{t('webhooks.log.event')}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{t('webhooks.log.status')}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{t('webhooks.log.attempts')}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{t('webhooks.log.answer')}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{t('webhooks.log.next')}</th>
                <th scope="col" className="py-1"><span className="sr-only">{t('webhooks.log.send_again')}</span></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-t border-gray-100 align-top dark:border-gray-800">
                  <td className="py-2 pr-3 whitespace-nowrap">{moment(d.created_at)}</td>
                  <td className="py-2 pr-3"><code className="text-xs">{d.event}</code></td>
                  <td className="py-2 pr-3"><Badge variant={STATUS_VARIANT[d.status]}>{t(STATUS_TEXT[d.status])}</Badge></td>
                  <td className="py-2 pr-3">{d.attempts}</td>
                  <td className="py-2 pr-3">
                    {d.response_code ?? t('webhooks.log.no_answer')}
                    {d.error && <span className="block text-xs text-red-600 dark:text-red-400">{d.error}</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{d.next_attempt_at ? moment(d.next_attempt_at) : ''}</td>
                  <td className="py-2">
                    <Button type="button" size="sm" variant="outline" disabled={again.isPending} aria-label={t('webhooks.log.send_again_aria', { event: d.event })} onClick={() => again.mutate(d.id)}>
                      {t('webhooks.log.send_again')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

interface CardProps {
  webhook: Webhook
  onEdit: () => void
  onSecret: (name: string, secret: string) => void
}

function WebhookCard({ webhook, onEdit, onSecret }: CardProps) {
  const { t } = useTranslation()
  const test = useTestWebhook()
  const rotate = useRotateWebhookSecret()
  const remove = useRemoveWebhook()
  const enable = useEnableWebhook()
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string; answer: string | null } | null>(null)

  const offByFixflow = !webhook.enabled && webhook.disabled_at != null
  const status = webhook.enabled
    ? { text: t('webhooks.status.active'), variant: 'success' as const }
    : offByFixflow
      ? { text: t('webhooks.status.off_by_fixflow'), variant: 'destructive' as const }
      : { text: t('webhooks.status.off_by_you'), variant: 'secondary' as const }

  const sendTest = () => {
    setOutcome(null)
    test.mutate(webhook.id, {
      onSuccess: ({ delivery }) => {
        const answer = delivery.response_excerpt ? t('webhooks.test.answer', { excerpt: delivery.response_excerpt }) : null
        setOutcome(
          delivery.status === 'delivered'
            ? { ok: true, message: t('webhooks.test.delivered', { code: delivery.response_code ?? '' }), answer }
            : { ok: false, message: t('webhooks.test.failed', { error: [delivery.error, delivery.response_code].filter(Boolean).join(' ') }), answer },
        )
      },
      onError: (error) => setOutcome({ ok: false, message: serverMessage(error) ?? t('webhooks.test.request_failed'), answer: null }),
    })
  }

  const renew = () => {
    if (!confirm(t('webhooks.confirm.rotate'))) return
    rotate.mutate(webhook.id, { onSuccess: (data) => onSecret(webhook.name, data.secret) })
  }

  const destroy = () => {
    if (!confirm(t('webhooks.confirm.delete'))) return
    remove.mutate(webhook.id)
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{webhook.name}</h2>
          <Badge variant={status.variant}>{status.text}</Badge>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400"><span className="sr-only">{t('webhooks.row.address')}: </span>{webhook.url}</p>
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('webhooks.row.events')}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {webhook.events.map((key) => (
              <li key={key}><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">{key}</code></li>
            ))}
          </ul>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {webhook.last_delivery_at ? t('webhooks.row.last_message', { when: timeAgo(webhook.last_delivery_at) }) : t('webhooks.row.no_message_yet')}
        </p>
        {webhook.consecutive_failures > 0 && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t('webhooks.row.failures', { count: webhook.consecutive_failures })}</p>
        )}
        {offByFixflow && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <span>{webhook.disabled_reason}</span>
            <Button type="button" size="sm" variant="outline" disabled={enable.isPending} onClick={() => enable.mutate(webhook.id)}>{t('webhooks.row.switch_on')}</Button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" aria-label={t('webhooks.row.edit_aria', { name: webhook.name })} onClick={onEdit}>{t('webhooks.row.edit')}</Button>
          <Button type="button" size="sm" variant="outline" disabled={test.isPending} aria-label={t('webhooks.row.test_aria', { name: webhook.name })} onClick={sendTest}>
            {test.isPending ? t('webhooks.row.testing') : t('webhooks.row.test')}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={rotate.isPending} aria-label={t('webhooks.row.rotate_aria', { name: webhook.name })} onClick={renew}>{t('webhooks.row.rotate')}</Button>
          <Button type="button" size="sm" variant="outline" aria-expanded={open} aria-label={t('webhooks.row.messages_aria', { name: webhook.name })} onClick={() => setOpen((o) => !o)}>{t('webhooks.row.messages')}</Button>
          <Button type="button" size="sm" variant="ghost" className="text-red-600 dark:text-red-400" disabled={remove.isPending} aria-label={t('webhooks.row.delete_aria', { name: webhook.name })} onClick={destroy}>{t('webhooks.row.delete')}</Button>
        </div>
        {outcome && (
          <div role={outcome.ok ? 'status' : 'alert'} className="mt-2 space-y-0.5">
            <p className={`text-sm ${outcome.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>{outcome.message}</p>
            {outcome.answer && <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{outcome.answer}</p>}
          </div>
        )}
        {open && <RecentMessages webhook={webhook} />}
      </CardContent>
    </Card>
  )
}

export function WebhooksPage() {
  const { t } = useTranslation()
  const { data, isLoading, refetch } = useWebhooks()
  const [editing, setEditing] = useState<Webhook | 'new' | null>(null)
  const [secret, setSecret] = useState<{ name: string; secret: string; renewed: boolean } | null>(null)

  const header = <PageHeader title={t('webhooks.page.title')} description={t('webhooks.page.description')} />
  if (isLoading) return <div className="max-w-3xl space-y-4">{header}<Skeleton className="h-40" /></div>
  if (!data) {
    return (
      <div className="max-w-3xl space-y-3">
        {header}
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('webhooks.page.load_failed')}</p>
        <Button variant="outline" onClick={() => refetch()}>{t('webhooks.page.try_again')}</Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {header}
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">{t('webhooks.page.note')}</p>
      <div>
        <Button type="button" onClick={() => setEditing('new')}>{t('webhooks.page.add')}</Button>
      </div>

      {data.webhooks.length === 0 ? (
        <EmptyState title={t('webhooks.page.empty_title')} description={t('webhooks.page.empty_text')} />
      ) : (
        <div className="space-y-4">
          {data.webhooks.map((webhook) => (
            <WebhookCard key={webhook.id} webhook={webhook} onEdit={() => setEditing(webhook)} onSecret={(name, value) => setSecret({ name, secret: value, renewed: true })} />
          ))}
        </div>
      )}

      <details className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-gray-100">{t('webhooks.example.title')}</summary>
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{t('webhooks.example.intro')}</p>
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{t('webhooks.example.body')}</p>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-800"><code>{SAMPLE_BODY}</code></pre>
      </details>

      {editing && (
        <WebhookForm
          webhook={editing === 'new' ? null : editing}
          events={data.events}
          onClose={() => setEditing(null)}
          onSecret={(name, value) => setSecret({ name, secret: value, renewed: false })}
        />
      )}
      {secret && <SecretDialog name={secret.name} secret={secret.secret} renewed={secret.renewed} onClose={() => setSecret(null)} />}
    </div>
  )
}
