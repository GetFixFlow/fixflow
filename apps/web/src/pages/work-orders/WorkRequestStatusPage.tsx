import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Clock, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { workRequestsApi } from '@/api'
import type { WorkRequest } from '@/types'

const STATUS_STEPS: Array<{
  key: WorkRequest['status']
  label: string
  description: string
}> = [
  { key: 'received', label: 'Request received', description: 'Your request has been logged.' },
  { key: 'created', label: 'Work order created', description: 'A work order was created.' },
  { key: 'assigned', label: 'Assigned to technician', description: 'A technician has been assigned.' },
  { key: 'in_progress', label: 'Work in progress', description: 'Maintenance is underway.' },
  { key: 'completed', label: 'Completed', description: 'Issue resolved.' },
]

const STATUS_ORDER: WorkRequest['status'][] = [
  'received',
  'created',
  'assigned',
  'in_progress',
  'completed',
]

export function WorkRequestStatusPage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['work_requests', token],
    queryFn: () => workRequestsApi.get(token!).then((r) => r.data.data),
    enabled: !!token,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Request not found.</p>
          <a href="/request" className="mt-3 block text-sm text-brand-600 hover:underline">
            Submit a new request
          </a>
        </div>
      </div>
    )
  }

  const currentIdx = STATUS_ORDER.indexOf(data.status)

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-lg space-y-6 py-12">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Request Status</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Submitted {format(new Date(data.created_at), 'MMMM d, yyyy')}
          </p>
        </div>

        {/* Status card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-gray-500 dark:text-gray-400">
              {token}
            </span>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                data.status === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400',
              )}
            >
              {data.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Progress steps */}
          <ol className="space-y-3">
            {STATUS_STEPS.map((step, idx) => {
              const done = idx <= currentIdx
              const active = idx === currentIdx
              return (
                <li key={step.key} className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      done
                        ? 'bg-green-500'
                        : 'border-2 border-gray-300 dark:border-gray-600',
                    )}
                  >
                    {done ? (
                      active ? (
                        <Clock className="h-3 w-3 text-white" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5 text-white" />
                      )
                    ) : null}
                  </div>
                  <div>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        done
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-400 dark:text-gray-500',
                      )}
                    >
                      {step.label}
                    </p>
                    {done && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {step.description}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          {/* Description */}
          {data.description && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Your request:</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 italic">
                "{data.description}"
              </p>
            </div>
          )}
        </div>

        <div className="text-center">
          <a
            href="/request"
            className="text-sm text-brand-600 hover:underline dark:text-brand-400"
          >
            Submit another request
          </a>
        </div>
      </div>
    </div>
  )
}
