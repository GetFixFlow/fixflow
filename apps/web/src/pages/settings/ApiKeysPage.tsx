import { useState } from 'react'
import { Plus, MoreVertical, Key } from 'lucide-react'
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
import { toast } from 'sonner'
import type { ApiKeyWithSecret } from '@/types'

export function ApiKeysPage() {
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
    <div className="space-y-6">
      {/* Modals */}
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

      {/* Revoke confirm dialog */}
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

      <PageHeader
        title="IoT API Keys"
        description="Manage API keys for IoT device authentication"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Create API Key
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
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
                    <th className="px-4 py-3" />
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
                            status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            status === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
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
                                    className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
