import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateApiKey } from '@/hooks/useIoT'
import type { ApiKeyCreateRequest, ApiKeyScope, ApiKeyWithSecret } from '@/types'

// The order they are shown and sent in.
const SCOPES: ApiKeyScope[] = ['iot', 'read', 'write']
const DEFAULT_SCOPES: ApiKeyScope[] = ['iot']

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
  const { t } = useTranslation()
  const [scopes, setScopes] = useState<ApiKeyScope[]>(DEFAULT_SCOPES)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const createKey = useCreateApiKey()

  // Writing includes reading: ticking write ticks and locks read, and unticking read unticks write.
  const toggleScope = (scope: ApiKeyScope) => {
    setScopes((prev) => {
      const on = !prev.includes(scope)
      let next = on ? [...prev, scope] : prev.filter((s) => s !== scope)
      if (scope === 'write' && on && !next.includes('read')) next = [...next, 'read']
      if (scope === 'read' && !on) next = next.filter((s) => s !== 'write')
      return SCOPES.filter((s) => next.includes(s))
    })
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (scopes.length === 0) errs.scopes = t('apiKeys.scopes.required')
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
    setName(''); setDescription(''); setExpiresAt(''); setNoExpiry(false); setScopes(DEFAULT_SCOPES)
  }

  return (
    <Modal open={open} onClose={onClose} title={t('apiKeys.modal.title')} description={t('apiKeys.modal.description')}>
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
          <label htmlFor="key-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
          <textarea
            id="key-description"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
          />
        </div>

        <div>
          <label htmlFor="key-expires" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Expires At</label>
          <Input
            id="key-expires"
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
          <p id="key-scopes-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('apiKeys.scopes.title')}</p>
          <div role="group" aria-labelledby="key-scopes-label" aria-describedby={errors.scopes ? 'key-scopes-error' : undefined} className="space-y-2">
            {SCOPES.map((scope) => {
              const locked = scope === 'read' && scopes.includes('write')
              return (
                <div key={scope} className={`flex items-start gap-2 ${locked ? 'opacity-70' : ''}`}>
                  <input
                    id={`key-scope-${scope}`}
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    disabled={locked}
                    onChange={() => toggleScope(scope)}
                    aria-describedby={`key-scope-${scope}-note`}
                    className={`mt-0.5 rounded ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                  <div>
                    <label htmlFor={`key-scope-${scope}`} className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {t(`apiKeys.scopes.${scope}`)} <code className="ml-1 font-mono text-xs text-gray-500 dark:text-gray-400">{scope}</code>
                    </label>
                    <p id={`key-scope-${scope}-note`} className="text-xs text-gray-500 dark:text-gray-400">
                      {t(`apiKeys.scopes.${scope}_hint`)}
                      {locked && <> {t('apiKeys.scopes.read_required')}.</>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          {errors.scopes && <p id="key-scopes-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.scopes}</p>}
          {scopes.includes('write') && (
            <div role="note" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <p className="text-sm text-amber-700 dark:text-amber-300">{t('apiKeys.scopes.write_warning')}</p>
            </div>
          )}
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
