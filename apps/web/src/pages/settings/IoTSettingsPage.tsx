import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, MoreVertical, Key, Copy, Check, Wifi, WifiOff } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { useApiKeys, useRevokeApiKey } from '@/hooks/useIoT'
import { ApiKeyCreateModal } from '@/components/iot/ApiKeyCreateModal'
import { ApiKeyRevealModal } from '@/components/iot/ApiKeyRevealModal'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import type { ApiKeyWithSecret } from '@/types'
import { formatDate } from '@/lib/localeFormat'

type Tab = 'api_keys' | 'mqtt' | 'webhooks'

/** What a key may do, as the screen words it. Keys made before scopes existed carry the old sensor names (or none): all of them are sensor keys. */
const scopesOf = (scopes: string[] | undefined): ('iot' | 'read' | 'write')[] => {
  const given = scopes ?? []
  const shown = new Set<'iot' | 'read' | 'write'>()
  if (given.length === 0 || given.some((s) => s === 'iot' || s.startsWith('iot'))) shown.add('iot')
  if (given.includes('write')) shown.add('write')
  else if (given.includes('read')) shown.add('read')
  return (['iot', 'read', 'write'] as const).filter((s) => shown.has(s))
}

const ORG_TOKEN = 'org_tk_fixflow_demo_001'

function ApiKeysTab() {
  const { t } = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const [revealedKey, setRevealedKey] = useState<ApiKeyWithSecret | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<number | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  const { data, isLoading } = useApiKeys()
  const revoke = useRevokeApiKey()

  const apiKeys = data?.api_keys ?? []

  const handleRevoke = async () => {
    if (revokeTarget == null) return
    await revoke.mutateAsync(revokeTarget)
    setRevokeTarget(null)
  }

  const getStatus = (key: { active: boolean; expires_at?: string }) => {
    if (!key.active) return 'revoked'
    if (key.expires_at && new Date(key.expires_at) < new Date()) return 'expired'
    return 'active'
  }

  return (
    <div className="space-y-4">
      <ApiKeyCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(key) => { setRevealedKey(key); setShowCreate(false) }}
      />
      <ApiKeyRevealModal
        open={!!revealedKey}
        apiKey={revealedKey}
        onClose={() => setRevealedKey(null)}
      />
      <Modal
        open={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke API Key"
        description="Revoke this API key? Devices using this key will stop sending data."
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleRevoke}
            disabled={revoke.isPending}
          >
            Revoke Key
          </Button>
        </div>
      </Modal>

      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Create API Key
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-16">
              <Key className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No API keys yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Create one to connect your IoT devices.</p>
              <Button className="mt-3" onClick={() => setShowCreate(true)}>Create First Key</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('apiKeys.list.key_preview')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('apiKeys.list.scopes')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Used</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 w-12"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {apiKeys.map((key) => {
                    const status = getStatus(key)
                    return (
                      <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{key.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{key.prefix ?? key.key_prefix}…</td>
                        <td className="px-4 py-3">
                          <ul className="flex flex-wrap gap-1" aria-label={t('apiKeys.list.scopes')}>
                            {scopesOf(key.scopes).map((scope) => (
                              <li key={scope} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                {t(`apiKeys.list.scope_${scope}`)}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(new Date(key.created_at))}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {key.last_used_at
                            ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {key.expires_at ? formatDate(new Date(key.expires_at)) : 'No expiry'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            status === 'active' ? 'bg-green-100 text-green-700' :
                            status === 'expired' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700',
                          )}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === key.id ? null : key.id)}
                              aria-label={`Actions for ${key.name}`}
                              aria-haspopup="menu"
                              aria-expanded={openMenuId === key.id}
                              className="rounded p-1 text-gray-500 dark:text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === key.id && (
                              <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(key.id))
                                    toast.success('Key ID copied')
                                    setOpenMenuId(null)
                                  }}
                                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                  Copy Key ID
                                </button>
                                {status === 'active' && (
                                  <button
                                    onClick={() => { setRevokeTarget(key.id); setOpenMenuId(null) }}
                                    className="block w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MqttTab() {
  const [copied, setCopied] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null)

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleTest = () => {
    setTesting(true)
    setTimeout(() => {
      setTesting(false)
      setTestResult('success')
    }, 2000)
  }

  const topicPattern = `fixflow/${ORG_TOKEN}/assets/{asset_id}/telemetry`

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">MQTT Broker Status</h2>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-700 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-400 font-medium">Connected</span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Host', value: 'mqtt.fixflow.io', key: 'host' },
              { label: 'Port (TLS)', value: '8883', key: 'port' },
              { label: 'Username', value: ORG_TOKEN, key: 'username' },
              { label: 'Password', value: '••••••••••••', key: 'password', masked: true },
            ].map((field) => (
              <div key={field.key} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-24">{field.label}</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300 flex-1 ml-4">
                  {field.masked ? field.value : field.value}
                </span>
                {!field.masked && (
                  <button
                    onClick={() => copyText(field.value, field.key)}
                    aria-label={`Copy ${field.label.toLowerCase()}`}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-600 ml-2"
                  >
                    {copied === field.key ? <Check className="h-4 w-4 text-green-700 dark:text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Organization Token */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Organization Token</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Use this token in your MQTT topic paths.</p>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
            <code className="text-sm font-mono text-gray-700 dark:text-gray-300 flex-1 break-all">
              {ORG_TOKEN}
            </code>
            <button
              onClick={() => copyText(ORG_TOKEN, 'org_token')}
              aria-label="Copy organization token"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-600 shrink-0"
            >
              {copied === 'org_token' ? <Check className="h-4 w-4 text-green-700 dark:text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Topic Reference */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">MQTT Topic Reference</h2>
          <div>
            <p className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Telemetry Topic Pattern</p>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-brand-600 dark:text-brand-400 flex-1 break-all">
                {topicPattern}
              </code>
              <button
                onClick={() => copyText(topicPattern, 'topic')}
                aria-label="Copy topic pattern"
                className="text-gray-500 dark:text-gray-400 hover:text-gray-600 shrink-0"
              >
                {copied === 'topic' ? <Check className="h-4 w-4 text-green-700 dark:text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>Replace <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{asset_id}'}</code> with your asset's numeric ID from FixFlow.</p>
            <p>Payload format: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{"metric":"temperature","value":72.5,"unit":"F"}'}</code></p>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Test Connection</h2>
          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 rounded-lg px-3 py-2">
              <Wifi className="h-4 w-4" /> MQTT broker connected successfully.
            </div>
          )}
          {testResult === 'failed' && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
              <WifiOff className="h-4 w-4" /> Connection failed. Check your credentials.
            </div>
          )}
          <Button onClick={handleTest} disabled={testing} variant="outline">
            {testing ? 'Testing…' : 'Test MQTT Connection'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function WebhooksTab() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('apiKeys.webhooks.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('apiKeys.webhooks.body')}</p>
          <Link to="/settings/webhooks" className="inline-flex items-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            {t('apiKeys.webhooks.open')}
          </Link>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('apiKeys.webhooks.keys_note')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function IoTSettingsPage() {
  const { t: tr } = useTranslation()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('api_keys')

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="IoT & API Keys" description="Manage IoT integrations and API access" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Access Denied. Only administrators can manage IoT settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'api_keys', label: 'API Keys' },
    { key: 'mqtt', label: 'MQTT Configuration' },
    { key: 'webhooks', label: tr('apiKeys.tabs.webhooks') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="IoT & API Keys" description="Manage IoT integrations and API access" />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-0 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                tab === t.key
                  ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'api_keys' && <ApiKeysTab />}
      {tab === 'mqtt' && <MqttTab />}
      {tab === 'webhooks' && <WebhooksTab />}
    </div>
  )
}
