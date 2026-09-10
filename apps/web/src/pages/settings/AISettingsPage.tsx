import { CheckCircle, XCircle, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useAI } from '@/hooks/useAI'

const FEATURES = [
  'FixFlow Assist (in-work-order chat)',
  'AI Work Order Creation',
  'Procedure Generator',
  'Smart Time Estimates',
  'Voice Completion Notes',
  'Natural Language Analytics',
  'Anomaly Detection',
]

export function AISettingsPage() {
  const { user } = useAuthStore()
  const { enabled, model, isLoading } = useAI()

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Features" description="Configure FixFlow's AI capabilities" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can manage AI settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Features" description="Configure FixFlow's AI capabilities, powered by Anthropic Claude" />

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !enabled ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">AI features are disabled</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Set <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-700">AI_ENABLED=true</code> and{' '}
                  <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-700">ANTHROPIC_API_KEY</code> in your
                  server's <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-700">.env</code> file to enable.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">AI features are enabled</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Provider: Anthropic Claude &middot; Model:{' '}
                  <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-700">{model}</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Sparkles className="h-4 w-4 text-brand-500" />
            AI Features
          </h3>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {enabled ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                )}
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Privacy</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI features send work order context to Anthropic's API. No data is stored by Anthropic or used for
            training.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">Data sent</p>
              <p className="text-gray-500 dark:text-gray-400">Asset names, work order descriptions, manual excerpts</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">Data NOT sent</p>
              <p className="text-gray-500 dark:text-gray-400">User emails, passwords, API keys</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
