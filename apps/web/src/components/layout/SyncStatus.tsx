import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useOfflineState, useOnlineStatus } from '@/hooks/useOfflineQueue'
import { offlineQueue } from '@/lib/offlineQueue'
import { useSyncNow } from './OfflineSync'

/** Shown only when there is something to know: no connection, changes waiting, or changes the server refused. */
export function SyncStatus() {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  const { queue, rejected } = useOfflineState()
  const syncNow = useSyncNow()

  if (online && queue.length === 0 && rejected.length === 0) return null

  const needsAttention = rejected.length > 0
  const label = !online
    ? queue.length > 0 ? t('shell.sync.offline_waiting', { count: queue.length }) : t('shell.sync.offline')
    : needsAttention && queue.length === 0 ? t('shell.sync.not_saved', { count: rejected.length }) : t('shell.sync.waiting', { count: queue.length })

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            needsAttention ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
          aria-label={t('shell.sync.status')}
        >
          {needsAttention ? <TriangleAlert className="h-3.5 w-3.5" /> : online ? <RefreshCw className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {!online && (
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              {t('shell.sync.offline_notice')}
            </p>
          )}

          {queue.length > 0 && (
            <div className="mb-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('shell.sync.waiting_title')}</h3>
              <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
                {queue.map((a) => (
                  <li key={a.id}>
                    {a.label}
                    {a.type === 'comment' && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">“{a.body}”</span>}
                  </li>
                ))}
              </ul>
              {online && (
                <Button size="sm" variant="outline" className="mt-2" onClick={syncNow}>
                  {t('shell.sync.send_now')}
                </Button>
              )}
            </div>
          )}

          {rejected.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">{t('shell.sync.rejected_title')}</h3>
              <ul className="space-y-2 text-sm">
                {rejected.map(({ action, message }) => (
                  <li key={action.id} className="rounded-md bg-red-50 p-2 dark:bg-red-900/20">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{action.label}</p>
                    {action.type === 'comment' && <p className="text-xs text-gray-500 dark:text-gray-400">“{action.body}”</p>}
                    <p className="text-xs text-red-700 dark:text-red-300">{message}</p>
                    <button className="mt-1 text-xs text-gray-500 dark:text-gray-400 underline" onClick={() => offlineQueue.dismissRejected(action.id)}>
                      {t('shell.sync.dismiss')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
