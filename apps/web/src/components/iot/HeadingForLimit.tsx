import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/Card'
import { useAI, useLimitForecasts } from '@/hooks/useAI'
import { currentLanguage } from '@/i18n'
import type { LimitForecast } from '@/api/ai'

const amount = (value: number, unit: string | null) => [Number(value.toFixed(2)), unit].filter((part) => part !== null && part !== '').join(' ')
const days = (value: number) => Math.max(1, Math.round(value))
/** "in 12 days", "tomorrow", "en 12 días": in the language of the screens. */
const inDays = (value: number) => new Intl.RelativeTimeFormat(currentLanguage(), { numeric: 'auto' }).format(days(value), 'day')
const onDate = (iso: string) => new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(new Date(`${iso}T12:00:00`))

function Row({ forecast }: { forecast: LimitForecast }) {
  const { t } = useTranslation()
  const moving = forecast.slope_per_day > 0 ? 'ai.forecast.limits.rising' : 'ai.forecast.limits.falling'

  return (
    <li className="py-3">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        <Link to={`/assets/${forecast.asset.id}`} className="hover:underline">{forecast.asset.name}</Link>
        <span className="font-normal text-gray-600 dark:text-gray-400">
          {' · '}
          {t(moving, {
            metric: forecast.metric_name,
            current: amount(forecast.current, forecast.unit),
            rate: amount(Math.abs(forecast.slope_per_day), forecast.unit),
          })}
        </span>
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-200">
        {t('ai.forecast.limits.reaches', { limit: amount(forecast.limit, forecast.unit), when: inDays(forecast.days_left), date: onDate(forecast.reaches_on) })}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {days(forecast.days_soonest) === days(forecast.days_latest)
          ? t('ai.forecast.limits.range_narrow')
          : t('ai.forecast.limits.range', { soonest: days(forecast.days_soonest), latest: days(forecast.days_latest) })}
        {' · '}
        {t('ai.forecast.limits.basis', { history: forecast.days_of_history, points: forecast.points, rule: forecast.rule.name })}
      </p>
    </li>
  )
}

/**
 * Sensors on course to reach a limit that was set on an alert rule, from the way they have moved over the last 30 days. A forecast,
 * with its range and what it rests on, and only for a sensor whose movement is plain enough to say anything about.
 */
export function HeadingForLimit() {
  const { t } = useTranslation()
  const { features } = useAI()
  const { data } = useLimitForecasts(features.limits)
  const list = data ?? []

  if (!features.limits) return null

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <TrendingUp className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          {t('ai.forecast.limits.title')}
        </h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">{t('ai.forecast.limits.intro')}</p>
        {list.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{t('ai.forecast.limits.none')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
            {list.map((forecast) => <Row key={forecast.rule.id} forecast={forecast} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
