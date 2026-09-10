import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateApiKey } from '@/hooks/useIoT'
import type { ApiKeyCreateRequest, ApiKeyWithSecret } from '@/types'

interface ApiKeyCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (key: ApiKeyWithSecret) => void
}

export function ApiKeyCreateModal({ open, onClose, onCreated }: ApiKeyCreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [noExpiry, setNoExpiry] = useState(false)
  const [scopes, setScopes] = useState<string[]>(['iot_write'])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const createKey = useCreateApiKey()

  const toggleScope = (scope: string) => {
    if (scope === 'iot_write') return // required
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    const payload: ApiKeyCreateRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      scopes,
      expires_at: noExpiry || !expiresAt ? undefined : expiresAt,
    }
    const res = await createKey.mutateAsync(payload)
    const keyData = (res.data as { data: ApiKeyWithSecret }).data ?? (res as unknown as ApiKeyWithSecret)
    onCreated(keyData)
    onClose()
    // reset
    setName(''); setDescription(''); setExpiresAt(''); setNoExpiry(false); setScopes(['iot_write'])
  }

  return (
    <Modal open={open} onClose={onClose} title="Create API Key" description="API keys allow IoT devices to send sensor data to FixFlow.">
      <div className="space-y-4">
        <Input
          id="key-name"
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Factory Floor Gateway"
          error={errors.name}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
          <textarea
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Expires At</label>
          <Input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={noExpiry}
          />
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={noExpiry}
              onChange={(e) => setNoExpiry(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">No expiry</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scopes</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-not-allowed opacity-70">
              <input type="checkbox" checked disabled className="rounded" />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">iot_write</span>
                <span className="ml-2 text-xs text-gray-400">(required)</span>
                <p className="text-xs text-gray-500">Send sensor readings and telemetry data</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scopes.includes('iot_read')}
                onChange={() => toggleScope('iot_read')}
                className="rounded"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">iot_read</span>
                <p className="text-xs text-gray-500">Read sensor data and alert status</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createKey.isPending}>
            {createKey.isPending ? 'Creating...' : 'Create API Key'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
