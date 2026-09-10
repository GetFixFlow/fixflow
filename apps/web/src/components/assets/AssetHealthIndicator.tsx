import { cn } from '@/lib/utils'
import type { AssetStatus } from '@/types'

const STATUS_COLOR: Record<AssetStatus, string> = {
  operational: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  decommissioned: 'bg-gray-400',
  maintenance: 'bg-yellow-500',
  offline: 'bg-red-500',
  retired: 'bg-gray-400',
}

const STATUS_LABEL: Record<AssetStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  decommissioned: 'Decommissioned',
  maintenance: 'Maintenance',
  offline: 'Offline',
  retired: 'Retired',
}

interface AssetHealthIndicatorProps {
  status: AssetStatus
  variant?: 'dot' | 'badge' | 'bar'
  className?: string
}

export function AssetHealthIndicator({
  status,
  variant = 'dot',
  className,
}: AssetHealthIndicatorProps) {
  const color = STATUS_COLOR[status] ?? 'bg-gray-400'
  const label = STATUS_LABEL[status] ?? status

  if (variant === 'dot') {
    return (
      <span
        className={cn('inline-block h-2.5 w-2.5 rounded-full', color, className)}
        aria-label={label}
        title={label}
      />
    )
  }

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white',
          color,
          className,
        )}
      >
        {label}
      </span>
    )
  }

  // bar variant
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('h-2 w-16 rounded-full', color)} aria-label={label} />
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  )
}
