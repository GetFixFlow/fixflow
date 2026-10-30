import { useState } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import type { AxiosError } from 'axios'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useChatSettings, useUpdateChatSettings, useRemoveChatSettings, useTestChat } from '@/hooks/useChatSettings'
import type { ChatForm, ChatKind, ChatSettings } from '@/api/chat'
import { formatDateTime } from '@/lib/localeFormat'

const KINDS: { value: ChatKind; label: string; where: string }[] = [
  { value: 'slack', label: 'Slack (also Mattermost and Rocket.Chat)', where: 'In Slack: create an app with Incoming Webhooks, add it to the channel, and copy the Webhook URL. Mattermost and Rocket.Chat have Incoming Webhooks under Integrations and take the same message.' },
  { value: 'teams', label: 'Microsoft Teams', where: 'In Teams: open the channel, choose Workflows, "Post to a channel when a webhook request is received", and copy the address it gives you. FixFlow has not yet been tried against a real Teams: if it refuses messages, the reason is shown here.' },
]

type TestResult = { ok: boolean; message: string }

const serverMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ error?: { message?: string } }>).response?.data?.error?.message ?? fallback

function ChatForm({ status }: { status: ChatSettings }) {
  const update = useUpdateChatSettings()
  const remove = useRemoveChatSettings()
  const test = useTestChat()
  const [form, setForm] = useState<ChatForm>({ kind: status.kind, enabled: status.enabled, events: status.events, url: '' })
  const [result, setResult] = useState<TestResult | null>(null)

  const set = (changes: Partial<ChatForm>) => {
    setForm((f) => ({ ...f, ...changes }))
    setResult(null)
  }
  const toggleEvent = (key: string, on: boolean) =>
    set({ events: on ? [...form.events, key] : form.events.filter((e) => e !== key) })

  const haveAddress = status.url_set || form.url.trim() !== ''
  const problem = form.enabled && !haveAddress ? 'Paste the webhook address to turn messages on.' : null
  const kind = KINDS.find((k) => k.value === form.kind) ?? KINDS[0]

  const sendTest = () =>
    test.mutate(
      { kind: form.kind, url: form.url },
      {
        onSuccess: (r) => setResult({ ok: true, message: r.data.message }),
        onError: (e) => setResult({ ok: false, message: serverMessage(e, 'The test message could not be sent.') }),
      },
    )

  const forget = () => {
    if (!confirm('Remove the chat settings? FixFlow will stop posting to the channel and forget the webhook address.')) return
    remove.mutate(undefined, { onSuccess: () => setForm({ kind: 'slack', enabled: false, events: status.available_events.map((e) => e.key), url: '' }) })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Team Chat" description="Post to a Slack or Teams channel when things happen" />

      <div
        className={`flex items-center gap-3 rounded-lg border p-3 ${
          status.enabled && status.url_set
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
            : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
        }`}
      >
        {status.enabled && status.url_set ? <CheckCircle className="h-5 w-5 shrink-0 text-green-500" /> : <AlertCircle className="h-5 w-5 shrink-0 text-gray-400" />}
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {status.enabled && status.url_set ? `Messages are going to ${status.url_hint}` : 'Chat messages are off'}
          </p>
          {status.last_sent_at && <p className="text-xs text-gray-500">Last message sent {formatDateTime(status.last_sent_at)}.</p>}
        </div>
      </div>

      {status.last_error && (
        <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          The last message did not get through: {status.last_error}
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <label htmlFor="chat-kind" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Where to post
            </label>
            <select
              id="chat-kind"
              value={form.kind}
              onChange={(e) => set({ kind: e.target.value as ChatKind })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">{kind.where}</p>
          </div>

          <div>
            <label htmlFor="chat-url" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Webhook address
            </label>
            <Input
              id="chat-url"
              type="password"
              autoComplete="off"
              value={form.url}
              placeholder={status.url_set ? `Saved (${status.url_hint}). Leave blank to keep it.` : 'https://…'}
              onChange={(e) => set({ url: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">
              Anyone who has this address can post to your channel, so it is kept encrypted and never shown again.
            </p>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Post a message when</legend>
            <div className="space-y-1.5">
              {status.available_events.map((event) => (
                <label key={event.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={form.events.includes(event.key)}
                    onChange={(e) => toggleEvent(event.key, e.target.checked)}
                  />
                  {event.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="rounded" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            Post these messages
          </label>
          {problem && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {problem}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => update.mutate(form, { onSuccess: () => set({ url: '' }) })} disabled={!!problem || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" onClick={sendTest} disabled={!haveAddress || test.isPending}>
              {test.isPending ? 'Sending…' : 'Send a test message'}
            </Button>
            {status.url_set && (
              <Button variant="ghost" onClick={forget} disabled={remove.isPending} className="text-red-600">
                Remove
              </Button>
            )}
          </div>
          {result && (
            <p role={result.ok ? 'status' : 'alert'} className={`text-sm ${result.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
              {result.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function ChatSettingsPage() {
  const { data, isLoading, refetch } = useChatSettings()

  if (isLoading) return <Skeleton className="h-64 max-w-2xl" />
  if (!data) {
    return (
      <div className="max-w-2xl space-y-3">
        <PageHeader title="Team Chat" description="Post to a Slack or Teams channel when things happen" />
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          The chat settings could not be loaded.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  return <ChatForm key={`${data.kind}-${data.url_hint}-${data.enabled}`} status={data} />
}
