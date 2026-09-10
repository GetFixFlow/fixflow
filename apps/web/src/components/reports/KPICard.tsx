import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import type { TrendDirection } from '@/utils/reportUtils'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  previousValue?: string | number
  changePercent?: number
  trend?: TrendDirection
  trendLabel?: string
  sparklineData?: number[]
  onClick?: () => void
  loading?: boolean
  className?: string
  pulseCritical?: boolean
}

export function KPICard({
  title, value, subtitle, previousValue, changePercent, trend, trendLabel = 'vs prev period',
  sparklineData, onClick, loading, className, pulseCritical,
}: KPICardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-5 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    )
  }

  const trendIcon = trend === 'improved' ? ArrowUpRight : trend === 'degraded' ? ArrowDownRight : Minus
  const TrendIcon = trendIcon
  const trendColor = trend === 'improved' ? 'text-green-600 dark:text-green-400' :
                     trend === 'degraded' ? 'text-red-500 dark:text-red-400' : 'text-gray-400'

  return (
    <Card className={cn(
      'transition-all',
      onClick && 'cursor-pointer hover:shadow-md hover:border-brand-300',
      pulseCritical && 'border-red-400 animate-pulse',
      className,
    )} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
            {changePercent != null && trend && (
              <p className={cn('mt-1 flex items-center gap-0.5 text-xs font-medium', trendColor)}>
                <TrendIcon className="h-3 w-3" />
                {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}% {trendLabel}
              </p>
            )}
            {previousValue != null && (
              <p className="text-xs text-gray-400 mt-0.5">Prev: {previousValue}</p>
            )}
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="w-20 h-12 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData.map((v, i) => ({ v, i }))}>
                  <Line type="monotone" dataKey="v" stroke={
                    trend === 'improved' ? '#22c55e' : trend === 'degraded' ? '#ef4444' : '#6b7280'
                  } dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
