import { Boxes } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { useAI, usePartForecasts } from '@/hooks/useAI'
import type { PartForecast } from '@/api/ai'

const n = (value: number) => Number(value.toFixed(1))

function Row({ forecast }: { forecast: PartForecast }) {
  const { t } = useTranslation()
  const unit = forecast.part.unit ?? ''

  return (
    <li className="py-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        {forecast.part.name}
        <Badge variant={forecast.status === 'short' ? 'destructive' : 'warning'}>
          {forecast.status === 'short' ? t('ai.forecast.parts.short') : t('ai.forecast.parts.tight')}
        </Badge>
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-200">
        {t('ai.forecast.parts.expected', { expected: n(forecast.expected), low: n(forecast.low), high: n(forecast.high), unit })}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {t('ai.forecast.parts.held', { on_hand: n(forecast.on_hand), on_order: n(forecast.on_order) })}
        {forecast.days_of_stock !== null && <>{' · '}{t('ai.forecast.parts.days', { days: forecast.days_of_stock })}</>}
        {forecast.suggested_quantity > 0 && <>{' · '}{t('ai.forecast.parts.suggest', { quantity: forecast.suggested_quantity })}</>}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{t('ai.forecast.parts.basis', { periods: forecast.periods, uses: forecast.uses })}</p>
    </li>
  )
}

/**
 * The parts that may not last the next 30 days, from how much was used in the last months. A forecast with its range and what it
 * rests on, and only for a part used often enough to say anything about.
 */
export function PartsForecast() {
  const { t } = useTranslation()
  const { features } = useAI()
  const { data } = usePartForecasts(features.parts)
  const list = data ?? []

  if (!features.parts) return null

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Boxes className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          {t('ai.forecast.parts.title')}
        </h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">{t('ai.forecast.parts.intro')}</p>
        {list.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{t('ai.forecast.parts.none')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
            {list.map((forecast) => <Row key={forecast.part.id} forecast={forecast} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
