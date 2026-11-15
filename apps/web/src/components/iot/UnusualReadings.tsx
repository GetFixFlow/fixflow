import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAI, useAnswerAnomaly, useSensorAnomalies } from '@/hooks/useAI'
import { useAuthStore } from '@/stores/authStore'
import { timeAgo } from '@/lib/timeAgo'
import type { SensorAnomaly } from '@/api/ai'

const amount = (value: number, unit: string | null) => [Number(value.toFixed(2)), unit].filter((part) => part !== null && part !== '').join(' ')

function Row({ anomaly, canAnswer }: { anomaly: SensorAnomaly; canAnswer: boolean }) {
  const { t } = useTranslation()
  const acknowledge = useAnswerAnomaly('acknowledge')
  const dismiss = useAnswerAnomaly('dismiss')
  const busy = acknowledge.isPending || dismiss.isPending

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          <Link to={`/assets/${anomaly.asset.id}`} className="hover:underline">{anomaly.asset.name}</Link>
          <span className="font-normal text-gray-600 dark:text-gray-400">
            {' · '}
            {t('ai.anomalies.reads', { metric: anomaly.metric_name, value: amount(anomaly.value, anomaly.unit) })}
          </span>
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('ai.anomalies.usual', { low: Number(anomaly.usual_low.toFixed(2)), high: amount(anomaly.usual_high, anomaly.unit), readings: anomaly.baseline_count })}
          {' · '}
          {timeAgo(anomaly.recorded_at)}
        </p>
      </div>
      {canAnswer && (
        <div className="flex shrink-0 gap-2">
          {anomaly.status === 'open' && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => acknowledge.mutate(anomaly.id)}>
              {t('ai.anomalies.acknowledge')}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={busy} onClick={() => dismiss.mutate(anomaly.id)}>
            {t('ai.anomalies.dismiss')}
          </Button>
        </div>
      )}
    </li>
  )
}

/**
 * Readings far outside what that sensor usually reads, found by FixFlow from the sensor's own history (no limit set by anyone).
 * Shown only while AI is on and the administrator has not switched this off.
 */
export function UnusualReadings() {
  const { t } = useTranslation()
  const { features } = useAI()
  const role = useAuthStore((state) => state.user?.role)
  const canAnswer = role === 'admin' || role === 'manager'
  const { data } = useSensorAnomalies('open', features.anomalies)
  const acknowledged = useSensorAnomalies('acknowledged', features.anomalies)
  const list = [...(data ?? []), ...(acknowledged.data ?? [])]

  if (!features.anomalies) return null

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Activity className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          {t('ai.anomalies.title')}
        </h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">{t('ai.anomalies.intro')}</p>
        {list.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{t('ai.anomalies.none')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
            {list.map((anomaly) => <Row key={anomaly.id} anomaly={anomaly} canAnswer={canAnswer} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
