import { useState } from 'react'
import { Plus, MoreVertical, Key, Copy, Check, Wifi, WifiOff } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
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

type Tab = 'api_keys' | 'mqtt' | 'webhooks'

const ORG_TOKEN = 'org_tk_fixflow_demo_001'

function ApiKeysTab() {
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
              <p className="text-xs text-gray-400 mt-1">Create one to connect your IoT devices.</p>
              <Button className="mt-3" onClick={() => setShowCreate(true)}>Create First Key</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key Preview</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {apiKeys.map((key) => {
                    const status = getStatus(key)
                    return (
                      <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{key.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{key.key_prefix}...</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {format(new Date(key.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {key.last_used_at
                            ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {key.expires_at ? format(new Date(key.expires_at), 'MMM d, yyyy') : 'No expiry'}
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
                              className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                                    className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">MQTT Broker Status</h3>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">Connected</span>
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
                <span className="text-sm text-gray-500 w-24">{field.label}</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300 flex-1 ml-4">
                  {field.masked ? field.value : field.value}
                </span>
                {!field.masked && (
                  <button
                    onClick={() => copyText(field.value, field.key)}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    {copied === field.key ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Organization Token</h3>
          <p className="text-xs text-gray-500">Use this token in your MQTT topic paths.</p>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
            <code className="text-sm font-mono text-gray-700 dark:text-gray-300 flex-1 break-all">
              {ORG_TOKEN}
            </code>
            <button
              onClick={() => copyText(ORG_TOKEN, 'org_token')}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              {copied === 'org_token' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Topic Reference */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">MQTT Topic Reference</h3>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Telemetry Topic Pattern</label>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-brand-600 dark:text-brand-400 flex-1 break-all">
                {topicPattern}
              </code>
              <button
                onClick={() => copyText(topicPattern, 'topic')}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                {copied === 'topic' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Replace <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{asset_id}'}</code> with your asset's numeric ID from FixFlow.</p>
            <p>Payload format: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{"metric":"temperature","value":72.5,"unit":"F"}'}</code></p>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Test Connection</h3>
          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/10 rounded-lg px-3 py-2">
              <Wifi className="h-4 w-4" /> MQTT broker connected successfully.
            </div>
          )}
          {testResult === 'failed' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
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
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-12 w-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
            <Key className="h-6 w-6 text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Webhook Support Coming Soon</h3>
            <p className="text-sm text-gray-500 mt-1">
              Get notified in real-time when events happen in FixFlow.
            </p>
          </div>
          <div className="text-left max-w-xs mx-auto">
            <p className="text-xs font-medium text-gray-500 mb-2">Available Events (coming soon)</p>
            <ul className="space-y-1 text-xs text-gray-400">
              {[
                'work_order.created', 'work_order.completed', 'work_order.overdue',
                'pm.generated', 'pm.overdue',
                'iot.alert.triggered', 'iot.alert.resolved',
                'asset.status_changed',
              ].map((event) => (
                <li key={event} className="font-mono">{event}</li>
              ))}
            </ul>
          </div>
          <Button disabled>Join Waitlist</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function IoTSettingsPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('api_keys')

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="IoT & API Keys" description="Manage IoT integrations and API access" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can manage IoT settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'api_keys', label: 'API Keys' },
    { key: 'mqtt', label: 'MQTT Configuration' },
    { key: 'webhooks', label: 'Webhook Setup' },
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
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
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
