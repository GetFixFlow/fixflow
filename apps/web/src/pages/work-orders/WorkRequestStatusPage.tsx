import { LanguageSelect } from '@/components/ui/LanguageSelect'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { CheckCircle, Clock, XCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { workRequestsApi } from '@/api'
import type { WorkRequestStatus } from '@/types'
import { formatDate } from '@/lib/localeFormat'

const STATUS_STEPS: Array<{ key: Exclude<WorkRequestStatus, 'cancelled'> }> = [
  { key: 'received' },
  { key: 'assigned' },
  { key: 'in_progress' },
  { key: 'completed' },
]

// Checked again now and then while the work is still going on.
const REFRESH_MS = 60_000

function Notice({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="absolute right-4 top-4 z-10"><LanguageSelect /></div>
      <div className="text-center">
        {children}
        <Link to="/request" className="mt-3 block text-sm text-brand-600 dark:text-brand-400 hover:underline">
          {t('workOrders.status.new')}
        </Link>
      </div>
    </main>
  )
}

export function WorkRequestStatusPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()

  // The link is the only secret: keep it out of the Referer header sent to anything the page opens.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['work_requests', token],
    queryFn: () => workRequestsApi.get(token!).then((r) => r.data.data),
    enabled: !!token,
    retry: false,
    refetchInterval: (query) =>
      query.state.data && ['completed', 'cancelled'].includes(query.state.data.status) ? false : REFRESH_MS,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    if (status === 404) {
      return (
        <Notice>
          <p className="text-gray-600 dark:text-gray-400">
            {t('workOrders.status.not_found')}
          </p>
        </Notice>
      )
    }
    if (status === 429) {
      return (
        <Notice>
          <p className="text-gray-600 dark:text-gray-400">{t('workOrders.status.too_many')}</p>
        </Notice>
      )
    }
    return (
      <Notice>
        <p className="text-gray-600 dark:text-gray-400">
          {t('workOrders.status.load_failed')}
        </p>
      </Notice>
    )
  }

  const cancelled = data.status === 'cancelled'
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === data.status)

  return (
    <main className="flex min-h-screen items-start justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="absolute right-4 top-4 z-10"><LanguageSelect /></div>
      <div className="w-full max-w-lg space-y-6 py-12">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('workOrders.status.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('workOrders.status.submitted', { date: formatDate(new Date(data.created_at)) })}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-gray-700 dark:text-gray-300">{data.title}</span>
            <span
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-sm font-medium',
                data.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                cancelled && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                !cancelled &&
                  data.status !== 'completed' &&
                  'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400',
              )}
            >
              {t(`workOrders.status.label_${data.status}`)}
            </span>
          </div>

          {cancelled ? (
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('workOrders.status.closed')}
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {STATUS_STEPS.map((step, idx) => {
                const done = idx <= currentIdx
                const active = idx === currentIdx && data.status !== 'completed'
                return (
                  <li key={step.key} className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        done ? 'bg-green-500' : 'border-2 border-gray-300 dark:border-gray-600',
                      )}
                    >
                      {done &&
                        (active ? (
                          <Clock className="h-3 w-3 text-white" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-white" />
                        ))}
                    </div>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          done ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
                        )}
                      >
                        {t(`workOrders.status.step_${step.key}`)}
                      </p>
                      {done && <p className="text-xs text-gray-500 dark:text-gray-400">{t(`workOrders.status.step_${step.key}_help`)}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {data.description && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('workOrders.status.yours')}</p>
              {/* Shown as plain text, line breaks kept: what a stranger typed is never treated as markup. */}
              <p className="mt-1 whitespace-pre-line text-sm italic text-gray-700 dark:text-gray-300">
                “{data.description}”
              </p>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link to="/request" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
            {t('workOrders.status.another')}
          </Link>
        </div>
      </div>
    </main>
  )
}
