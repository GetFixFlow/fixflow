import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface ChartContainerProps {
  title?: string
  subtitle?: string
  loading?: boolean
  error?: string
  empty?: boolean
  actions?: ReactNode
  children: ReactNode
  className?: string
  height?: number
}

export function ChartContainer({ title, subtitle, loading, error, empty, actions, children, className, height = 280 }: ChartContainerProps) {
  return (
    <div className={cn('rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {loading ? (
        <div style={{ height }} className="flex flex-col gap-2 justify-end">
          <Skeleton className="h-full w-full" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center text-red-500 text-sm" style={{ height }}>
          Failed to load chart data. <button className="ml-2 underline" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center justify-center text-gray-400 text-sm gap-2" style={{ height }}>
          <span className="text-3xl">📊</span>
          <span>No data for the selected period.</span>
        </div>
      ) : children}
    </div>
  )
}
