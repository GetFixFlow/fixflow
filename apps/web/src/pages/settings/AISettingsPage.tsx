import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useAiSettings, useRemoveAiSettings, useSaveAiSettings, useTestAi } from '@/hooks/useAI'
import type { AiChoice, AiForm, AiProvider, AiSettings } from '@/api/ai'

const PROVIDERS: AiProvider[] = ['none', 'anthropic', 'openai_compatible', 'local']
const HAS_ADDRESS: AiProvider[] = ['openai_compatible', 'local']
const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'
const HELP = 'mt-1 text-xs text-gray-500 dark:text-gray-400'

type Draft = { model: string; base_url: string; api_key: string }
type Result = { ok: boolean; message: string }

const serverMessage = (error: unknown) =>
  (error as AxiosError<{ error?: { message?: string } }> | null)?.response?.data?.error?.message ?? null

/** What each provider's fields start as: what is saved (a key is never sent back, so that stays blank). */
const startingDrafts = (status: AiSettings): Record<AiChoice, Draft> => {
  const draft = (kind: AiChoice): Draft => ({
    model: status.providers[kind].model ?? '',
    base_url: status.providers[kind].base_url ?? '',
    api_key: '',
  })
  return { anthropic: draft('anthropic'), openai_compatible: draft('openai_compatible'), local: draft('local') }
}

function AiSettingsForm({ status }: { status: AiSettings }) {
  const { t } = useTranslation()
  const save = useSaveAiSettings()
  const remove = useRemoveAiSettings()
  const test = useTestAi()
  const [provider, setProvider] = useState<AiProvider>(status.provider)
  const [drafts, setDrafts] = useState(() => startingDrafts(status))
  const [result, setResult] = useState<Result | null>(null)

  const kind = provider === 'none' ? null : provider
  const saved = kind ? status.providers[kind] : null
  const draft = kind ? drafts[kind] : null
  const where = kind === 'anthropic' ? 'api.anthropic.com' : (draft?.base_url.match(/^https?:\/\/([^/:]+)/)?.[1] ?? '…')
  const fromEnvironment = status.source === 'environment' && kind === 'anthropic'

  const form = (): AiForm => (kind && draft ? { provider: kind, ...draft } : { provider: 'none' })
  const edit = (changes: Partial<Draft>) => {
    if (!kind) return
    setDrafts((all) => ({ ...all, [kind]: { ...all[kind], ...changes } }))
    setResult(null)
  }
  const choose = (next: AiProvider) => {
    setProvider(next)
    setResult(null)
    save.reset()
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    save.mutate(form(), {
      onSuccess: () => {
        setDrafts((all) => (kind ? { ...all, [kind]: { ...all[kind], api_key: '' } } : all))
        toast.success(t('ai.toast.saved'))
      },
    })
  }

  const tryIt = () =>
    test.mutate(form(), {
      onSuccess: (r) => setResult({ ok: true, message: r.data.message }),
      onError: (e) => setResult({ ok: false, message: serverMessage(e) ?? t('ai.actions.test_failed') }),
    })

  const forget = () => {
    if (!confirm(t('ai.actions.remove_confirm'))) return
    remove.mutate(undefined, {
      onSuccess: (r) => {
        setProvider(r.data.ai.provider)
        setDrafts(startingDrafts(r.data.ai))
        setResult(null)
        toast.success(t('ai.toast.removed'))
      },
    })
  }

  const keyHelp = [
    t('ai.field.api_key_note', { where }),
    kind && HAS_ADDRESS.includes(kind) ? t('ai.field.api_key_host') : '',
    fromEnvironment ? t('ai.field.api_key_environment') : '',
  ].filter(Boolean).join(' ')

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card>
        <CardContent className="space-y-5 p-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{t('ai.provider.legend')}</legend>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <div
                  key={p}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    provider === p ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <input
                    id={`ai-provider-${p}`}
                    type="radio"
                    name="ai-provider"
                    className="mt-1"
                    value={p}
                    checked={provider === p}
                    aria-describedby={`ai-provider-${p}-help`}
                    onChange={() => choose(p)}
                  />
                  <div>
                    <label htmlFor={`ai-provider-${p}`} className="block cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t(`ai.provider.label.${p}`)}
                    </label>
                    <p id={`ai-provider-${p}-help`} className="text-xs text-gray-600 dark:text-gray-400">{t(`ai.provider.help.${p}`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          {kind && draft && saved && (
            <div className="space-y-4">
              {HAS_ADDRESS.includes(kind) && (
                <div>
                  <label htmlFor="ai-base-url" className={LABEL}>{t('ai.field.base_url')}</label>
                  <Input
                    id="ai-base-url"
                    type="url"
                    autoComplete="off"
                    value={draft.base_url}
                    placeholder={kind === 'local' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'}
                    onChange={(e) => edit({ base_url: e.target.value })}
                  />
                  <p className={HELP}>{t(`ai.field.base_url_${kind}`)}</p>
                </div>
              )}

              <div>
                <label htmlFor="ai-model" className={LABEL}>{t('ai.field.model')}</label>
                <Input
                  id="ai-model"
                  autoComplete="off"
                  value={draft.model}
                  placeholder={saved.default_model ?? ''}
                  onChange={(e) => edit({ model: e.target.value })}
                />
                <p className={HELP}>
                  {saved.default_model ? t('ai.field.model_default', { model: saved.default_model }) : kind === 'local' ? t('ai.field.model_local_help') : ''}
                </p>
              </div>

              <div>
                <label htmlFor="ai-api-key" className={LABEL}>{t(kind === 'local' ? 'ai.field.api_key_optional' : 'ai.field.api_key')}</label>
                <Input
                  id="ai-api-key"
                  type="password"
                  autoComplete="off"
                  value={draft.api_key}
                  placeholder={saved.key_set ? t('ai.field.api_key_saved') : ''}
                  onChange={(e) => edit({ api_key: e.target.value })}
                />
                <p className={HELP}>{keyHelp}</p>
              </div>
            </div>
          )}

          {save.isError && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {serverMessage(save.error) ?? t('ai.actions.save_failed')}
            </p>
          )}
          {result && (
            <p
              role={result.ok ? 'status' : 'alert'}
              className={`rounded-md p-3 text-sm ${
                result.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
              }`}
            >
              {result.message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('ai.actions.saving') : t('ai.actions.save')}</Button>
            {kind && (
              <Button type="button" variant="outline" onClick={tryIt} disabled={test.isPending}>
                {test.isPending ? t('ai.actions.testing') : t('ai.actions.test')}
              </Button>
            )}
            {status.source === 'app' && (
              <Button type="button" variant="ghost" onClick={forget} disabled={remove.isPending}>{t('ai.actions.remove')}</Button>
            )}
          </div>
          {kind && <p className={HELP}>{t('ai.actions.test_note')}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{t('ai.privacy.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t(`ai.privacy.${provider}`, { where })}</p>
          {kind && (
            <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">{t('ai.privacy.sent_title')}</p>
                <p className="text-gray-600 dark:text-gray-400">{t('ai.privacy.sent')}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">{t('ai.privacy.not_sent_title')}</p>
                <p className="text-gray-600 dark:text-gray-400">{t('ai.privacy.not_sent')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  )
}

function Status({ status }: { status: AiSettings }) {
  const { t } = useTranslation()
  const on = status.enabled
  // A provider that is chosen but cannot run (an address that was valid when saved and no longer is).
  const incomplete = !on && status.provider !== 'none'

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        on ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
      }`}
    >
      {on ? (
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-400" />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
      )}
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {on ? t('ai.status.on', { provider: t(`ai.provider.label.${status.provider}`) }) : t('ai.status.off')}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {on
            ? t('ai.status.sending', { where: status.where, model: status.providers[status.provider as AiChoice].model ?? status.providers[status.provider as AiChoice].default_model })
            : incomplete ? t('ai.status.incomplete') : t('ai.status.off_text')}
        </p>
        {on && status.source === 'environment' && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t('ai.status.environment')}</p>}
      </div>
    </div>
  )
}

export function AISettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const admin = user?.role === 'admin'
  const settings = useAiSettings(admin)

  if (!admin) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('ai.page.title')} description={t('ai.page.description')} />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">{t('ai.page.denied')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t('ai.page.title')} description={t('ai.page.description')} />

      {settings.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : settings.isError || !settings.data ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p role="alert" className="text-sm text-gray-700 dark:text-gray-300">{t('ai.page.load_failed')}</p>
            <Button variant="outline" onClick={() => settings.refetch()}>{t('ai.page.try_again')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Status status={settings.data} />
          <AiSettingsForm status={settings.data} />
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                {t('ai.features.title')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('ai.features.assist')}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
